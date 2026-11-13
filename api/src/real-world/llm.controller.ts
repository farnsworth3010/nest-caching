import { randomUUID } from 'node:crypto';
import { Body, Controller, HttpCode, Inject, Post, Res } from '@nestjs/common';
import { REDIS, type Redis } from '../redis/redis.module';
import { embed, fakeLlm, tokens } from './simulated';
import { id, oneOf, text } from './validate';

type Response = { status(code: number): { setHeader(name: string, value: number): unknown } };
type Body = Record<string, unknown> | undefined;
type Message = { role: 'user' | 'assistant'; content: string };

const TTL = 600;

const CACHE = 'llm:semcache';
// VSIM scores are (1 + cosine) / 2, so 0.9 means cosine 0.8.
const THRESHOLD = 0.9;
const ANSWER_TTL = 300;

const HISTORY = 6;
const CHAT_TTL = 900;

const TOKEN_LIMIT = 600;
const TOKEN_WINDOW_MS = 60_000;
const MAX_ANSWER_TOKENS = 120;
// Reserve the worst case before the model call; over the limit, roll the reservation back and refuse.
export const RESERVE_SCRIPT = `local used = redis.call('INCRBY', KEYS[1], ARGV[1])
if redis.call('PTTL', KEYS[1]) < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[3]) end
if used > tonumber(ARGV[2]) then return {0, redis.call('DECRBY', KEYS[1], ARGV[1])} end
return {1, used}`;
// After the call, swap the reservation for the real count; a plain INCRBY on an expired key would recreate it without a TTL.
export const ADJUST_SCRIPT = `if redis.call('EXISTS', KEYS[1]) == 0 then return false end
return redis.call('INCRBY', KEYS[1], ARGV[1])`;
const FILLER = 'Redis counts tokens per user and minute so that one heavy user cannot spend the whole model quota of the team'.split(' ');

const RAG = 'llm:rag:chunks';
const DOCS = {
  persistence:
    'Redis can persist data with RDB snapshots taken at intervals. The append-only file logs every write and can be fsynced every second. With both off, Redis is a pure in-memory cache and loses data on restart.',
  eviction:
    'When maxmemory is reached, Redis evicts keys according to the maxmemory-policy. allkeys-lru removes the least recently used keys from the whole keyspace. volatile-ttl removes the keys with the shortest time to live first.',
  replication:
    'A replica keeps a copy of the master by streaming its writes. Replication is asynchronous, so a failover can lose the last acknowledged writes. Sentinel watches the master and promotes a replica when it fails.',
  streams:
    'A stream is an append-only log of entries with ids. Consumer groups split the entries between workers and track pending ones. XACK confirms a processed entry, and XAUTOCLAIM hands entries of a dead worker to another one.',
};
const DOC_NAMES = Object.keys(DOCS) as (keyof typeof DOCS)[];

@Controller('real-world/llm')
export class LlmController {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  @Post('semantic-cache')
  @HttpCode(200)
  async semanticCache(@Body() body: Body) {
    const question = text(body?.question, 'question');
    const start = performance.now();
    const vector = embed(question);
    const [match, score] = Object.entries(await this.redis.vSimWithScores(CACHE, vector, { COUNT: 1 }))[0] ?? [];
    const matched = match ? ((await this.redis.vGetAttr(CACHE, match)) as { question?: string } | null)?.question : undefined;

    if (match && score >= THRESHOLD) {
      const answer = await this.redis.get(`${CACHE}:answer:${match}`);

      if (answer) return { hit: true, score, threshold: THRESHOLD, matched, answer, tokens: 0, ms: Math.round(performance.now() - start) };

      // The answer expired but its vector stayed: vector set elements have no TTL of their own.
      await this.redis.vRem(CACHE, match);
    }

    const llm = await fakeLlm(question, `To answer "${question}": open Settings, find the matching section and follow the steps there.`, 1500);
    const element = randomUUID().slice(0, 8);

    await this.redis.set(`${CACHE}:answer:${element}`, llm.text, { expiration: { type: 'EX', value: ANSWER_TTL } });
    await this.redis.vAdd(CACHE, vector, element, { SETATTR: { question } });
    await this.redis.expire(CACHE, TTL);

    return { hit: false, score: score ?? null, threshold: THRESHOLD, matched, answer: llm.text, tokens: llm.promptTokens + llm.answerTokens, ms: Math.round(performance.now() - start) };
  }

  @Post('chat')
  @HttpCode(200)
  async chat(@Body() body: Body) {
    const key = `llm:chat:${id(body?.session, 'session')}`;
    const message = text(body?.message, 'message');

    await this.append(key, { role: 'user', content: message });

    const context = (await this.redis.lRange(key, 0, -1)).map((m) => JSON.parse(m) as Message);
    const prompt = context.map((m) => `${m.role}: ${m.content}`).join('\n');
    const oldest = context.find((m) => m.role === 'user')!.content;
    const llm = await fakeLlm(prompt, `I got ${context.length} messages of context. The oldest user message I still see is "${oldest}".`, 1000);

    await this.append(key, { role: 'assistant', content: llm.text });

    return { prompt, reply: llm.text, promptTokens: llm.promptTokens, history: (await this.redis.lRange(key, 0, -1)).map((m) => JSON.parse(m) as Message), keep: HISTORY, ttl: await this.redis.ttl(key) };
  }

  @Post('token-budget')
  @HttpCode(200)
  async tokenBudget(@Body() body: Body, @Res({ passthrough: true }) res: Response) {
    const user = id(body?.user, 'user');
    const prompt = text(body?.prompt, 'prompt');
    const now = Date.now();
    const windowStart = now - (now % TOKEN_WINDOW_MS);
    const resetInMs = windowStart + TOKEN_WINDOW_MS - now;
    const key = `llm:tokens:${user}:${windowStart}`;
    const reserved = tokens(prompt) + MAX_ANSWER_TOKENS;

    const [ok, used] = (await this.redis.eval(RESERVE_SCRIPT, { keys: [key], arguments: [String(reserved), String(TOKEN_LIMIT), String(TOKEN_WINDOW_MS)] })) as [number, number];

    if (!ok) {
      res.status(429).setHeader('Retry-After', Math.ceil(resetInMs / 1000));

      return { allowed: false, reserved, used, limit: TOKEN_LIMIT, remaining: TOKEN_LIMIT - used, resetInMs, script: RESERVE_SCRIPT };
    }

    const words = 20 + Math.floor(Math.random() * 60);
    const llm = await fakeLlm(prompt, Array.from({ length: words }, (_, i) => FILLER[i % FILLER.length]).join(' '), 1000);
    const actual = llm.promptTokens + Math.min(llm.answerTokens, MAX_ANSWER_TOKENS);
    const after = Number((await this.redis.eval(ADJUST_SCRIPT, { keys: [key], arguments: [String(actual - reserved)] })) ?? 0);

    return { allowed: true, reserved, actual, used: after, limit: TOKEN_LIMIT, remaining: TOKEN_LIMIT - after, resetInMs, answer: llm.text, script: RESERVE_SCRIPT };
  }

  @Post('rag')
  @HttpCode(200)
  async rag(@Body() body: Body) {
    const question = text(body?.question, 'question');
    const doc = oneOf(body?.doc ?? 'any', 'doc', ['any', ...DOC_NAMES]);
    let indexed = 0;

    if (!(await this.redis.exists(RAG))) {
      // shortcut: one sentence per chunk; real pipelines split by tokens with some overlap.
      for (const name of DOC_NAMES) {
        for (const [i, chunk] of DOCS[name].split(/(?<=\.)\s+/).entries()) {
          await this.redis.vAdd(RAG, embed(chunk), `${name}:${i}`, { SETATTR: { doc: name, text: chunk } });
          indexed++;
        }
      }

      await this.redis.expire(RAG, TTL);
    }

    // doc is checked against DOC_NAMES above, so it is safe inside the FILTER expression.
    const scores = await this.redis.vSimWithScores(RAG, embed(question), { COUNT: 3, ...(doc === 'any' ? {} : { FILTER: `.doc == "${doc}"` }) });
    const chunks = [];

    for (const [element, score] of Object.entries(scores)) {
      const attrs = (await this.redis.vGetAttr(RAG, element)) as { doc: string; text: string };

      chunks.push({ element, score, ...attrs });
    }

    const sources = chunks.map((c, i) => `[${i + 1}] (${c.doc}) ${c.text}`).join('\n');
    const prompt = `Answer the question using only these sources and cite them.\n${sources}\n\nQuestion: ${question}`;
    const answer = chunks.length ? `${chunks[0].text} [1]${chunks.length > 1 ? ` See also [2]: ${chunks[1].text}` : ''}` : 'No source matched, so I cannot answer.';
    const llm = await fakeLlm(prompt, answer, 1200);

    return { indexed, chunks, prompt, answer: llm.text, promptTokens: llm.promptTokens };
  }

  private async append(key: string, message: Message) {
    // LTRIM keeps only the last HISTORY messages; the TTL drops idle sessions.
    await this.redis.multi().rPush(key, JSON.stringify(message)).lTrim(key, -HISTORY, -1).expire(key, CHAT_TTL).exec();
  }
}
