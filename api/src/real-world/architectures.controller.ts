import { randomUUID } from 'node:crypto';
import { Body, Controller, HttpCode, Inject, Post, Res } from '@nestjs/common';
import { REDIS, type Redis } from '../redis/redis.module';
import { check, id, int, oneOf, text } from './validate';

// express types are not installed; this is the part of its Response the handlers use.
type Response = { status(code: number): unknown };
type Body = Record<string, unknown> | undefined;

// Every demo key expires, so nothing piles up between runs.
const TTL = 600;
const SESSION_TTL = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const PLAYERS = ['ada', 'alan', 'grace', 'linus', 'margaret', 'ken', 'dennis', 'barbara', 'edsger', 'donald', 'frances', 'john', 'radia', 'tim', 'guido', 'bjarne', 'anders', 'brendan', 'yukihiro', 'james'];

const USERS = ['alice', 'bob', 'carol', 'dave'];
const CELEBRITY = 'celebrity';
// shortcut: the follow graph is a constant; a real app keeps it in its database (or a Redis set per user).
const FOLLOWERS: Record<string, string[]> = { alice: ['bob', 'carol', 'dave'], bob: ['alice', 'carol'], carol: ['alice', 'bob', 'dave'], dave: ['carol'] };
const TIMELINE_LENGTH = 50;

const JOBS = 'rw:jobs';
const GROUP = 'workers';
const MIN_IDLE_MS = 3000;

const PRESENCE = 'rw:presence';
const ONLINE_WINDOW_MS = 30_000;

const LEDGER = 'rw:payments:ledger';

const randomInt = (max: number) => Math.floor(Math.random() * max);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Controller('real-world')
export class ArchitecturesController {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  @Post('session')
  @HttpCode(200)
  async session(@Body() body: Body) {
    const action = oneOf(body?.action, 'action', ['login', 'request', 'logout'] as const);

    if (action === 'login') {
      const sid = randomUUID();
      const key = `rw:session:${sid}`;
      const now = new Date().toISOString();

      await this.redis.hSet(key, { user: id(body?.user, 'user'), createdAt: now, lastSeen: now, requests: 0 });
      await this.redis.expire(key, SESSION_TTL);

      return { sid, ...(await this.readSession(key)) };
    }

    const sid = body?.sid;
    check(typeof sid === 'string' && UUID.test(sid), 'sid must be a session id returned by login');
    const key = `rw:session:${sid}`;

    if (action === 'logout') return { sid, deleted: await this.redis.del(key), session: null };

    // Sliding TTL: each request pushes the expiry forward. EXPIRE answers 0 when the session is already gone.
    if (!(await this.redis.expire(key, SESSION_TTL))) return { sid, session: null, ttl: -2 };

    await this.redis.hIncrBy(key, 'requests', 1);
    await this.redis.hSet(key, 'lastSeen', new Date().toISOString());

    return { sid, ...(await this.readSession(key)) };
  }

  @Post('leaderboard')
  @HttpCode(200)
  async leaderboard(@Body() body: Body) {
    const events = int(body?.events, 'events', 0, 500);
    const player = oneOf(body?.player, 'player', PLAYERS);
    const key = 'rw:leaderboard';

    if (events) {
      const batch = this.redis.multi();

      for (let i = 0; i < events; i++) batch.zIncrBy(key, 1 + randomInt(50), PLAYERS[randomInt(PLAYERS.length)]);
      batch.expire(key, TTL);

      await batch.execAsPipeline();
    }

    return {
      top: await this.redis.zRangeWithScores(key, 0, 9, { REV: true }),
      player: { name: player, rank: await this.redis.zRevRank(key, player), score: await this.redis.zScore(key, player) },
      players: PLAYERS,
    };
  }

  @Post('feed')
  @HttpCode(200)
  async feed(@Body() body: Body) {
    const action = oneOf(body?.action, 'action', ['post', 'read'] as const);
    let writes = 0;

    if (action === 'post') {
      const author = oneOf(body?.author, 'author', [...USERS, CELEBRITY]);
      const post = JSON.stringify({ author, text: text(body?.text, 'text'), at: Date.now() });
      // Hybrid fan-out: a celebrity's post is written once and merged in at read time instead of into millions of timelines.
      const targets = author === CELEBRITY ? ['rw:feed:posts:celebrity'] : [author, ...FOLLOWERS[author]].map((u) => `rw:feed:timeline:${u}`);
      const tx = this.redis.multi();

      for (const key of targets) tx.lPush(key, post).lTrim(key, 0, TIMELINE_LENGTH - 1).expire(key, TTL);

      await tx.exec();
      writes = targets.length;
    }

    const reads = this.redis.multi().lRange('rw:feed:posts:celebrity', 0, 9);

    for (const user of USERS) reads.lRange(`rw:feed:timeline:${user}`, 0, 9);

    const [celebrity, ...own] = (await reads.execAsPipeline()) as unknown as string[][];
    const timelines = USERS.map((user, i) => ({
      user,
      posts: [...own[i], ...celebrity]
        .map((p) => JSON.parse(p) as { author: string; text: string; at: number })
        .sort((a, b) => b.at - a.at)
        .slice(0, 10),
    }));

    return { writes, followers: FOLLOWERS, timelines };
  }

  @Post('queue')
  @HttpCode(200)
  async queue(@Body() body: Body) {
    const action = oneOf(body?.action, 'action', ['enqueue', 'work', 'crash', 'reclaim'] as const);
    let result: unknown;

    if (action === 'enqueue') {
      if (!(await this.redis.exists(JOBS))) await this.redis.xGroupCreate(JOBS, GROUP, '0', { MKSTREAM: true });

      const ids = [];

      for (let i = 0; i < 3; i++) ids.push(await this.redis.xAdd(JOBS, '*', { job: `resize-image-${await this.redis.incr('rw:jobs:seq')}` }));

      await this.redis.expire(JOBS, TTL);
      await this.redis.expire('rw:jobs:seq', TTL);
      result = { added: ids };
    } else if (!(await this.redis.exists(JOBS))) {
      result = { note: 'The queue is empty. Enqueue jobs first.' };
    } else if (action === 'reclaim') {
      // Only messages idle for MIN_IDLE_MS move: a slow but alive worker keeps its job.
      const { messages } = await this.redis.xAutoClaim(JOBS, GROUP, 'worker-b', MIN_IDLE_MS, '0-0', { COUNT: 10 });
      const claimed = messages.flatMap((m) => (m ? [m] : []));

      for (const m of claimed) await this.redis.xAck(JOBS, GROUP, m.id);

      result = { worker: 'worker-b', claimedAndDone: claimed.map((m) => ({ id: m.id, job: m.message.job })), minIdleMs: MIN_IDLE_MS };
    } else {
      const reply = (await this.redis.xReadGroup(GROUP, 'worker-a', { key: JOBS, id: '>' }, { COUNT: 3 })) as unknown as { messages: { id: string; message: Record<string, string> }[] }[] | null;
      const jobs = reply?.[0]?.messages ?? [];
      // "crash": the worker dies while on its last job, before XACK, so that job stays pending under worker-a.
      const done = action === 'crash' ? jobs.slice(0, -1) : jobs;

      for (const m of done) await this.redis.xAck(JOBS, GROUP, m.id);

      result = { worker: 'worker-a', done: done.map((m) => ({ id: m.id, job: m.message.job })), crashedOn: action === 'crash' && jobs.length ? jobs.at(-1)!.message.job : null };
    }

    const exists = await this.redis.exists(JOBS);

    return {
      result,
      length: exists ? await this.redis.xLen(JOBS) : 0,
      pending: exists ? await this.redis.xPendingRange(JOBS, GROUP, '-', '+', 10) : [],
    };
  }

  @Post('presence')
  @HttpCode(200)
  async presence(@Body() body: Body) {
    const action = oneOf(body?.action, 'action', ['heartbeat', 'simulate', 'read'] as const);
    const now = Date.now();

    if (action === 'heartbeat') await this.redis.zAdd(PRESENCE, { score: now, value: id(body?.user, 'user') });
    if (action === 'simulate') await this.redis.zAdd(PRESENCE, PLAYERS.slice(0, 12).map((value) => ({ value, score: now - randomInt(60_000) })));

    const since = now - ONLINE_WINDOW_MS;
    const removed = await this.redis.zRemRangeByScore(PRESENCE, '-inf', since);
    await this.redis.expire(PRESENCE, TTL);

    return {
      removed,
      count: await this.redis.zCount(PRESENCE, since, '+inf'),
      online: (await this.redis.zRangeByScoreWithScores(PRESENCE, since, '+inf')).map(({ value, score }) => ({ user: value, secondsAgo: Math.round((now - score) / 1000) })),
      windowMs: ONLINE_WINDOW_MS,
    };
  }

  @Post('payment')
  @HttpCode(200)
  async payment(@Body() body: Body, @Res({ passthrough: true }) res: Response) {
    const idemKey = body?.key;
    check(typeof idemKey === 'string' && /^[\w-]{1,64}$/.test(idemKey), 'key must be 1..64 letters, digits, _ or -');
    const amount = int(body?.amount, 'amount', 1, 10_000);
    const key = `rw:idem:${idemKey}`;

    // NX makes the claim atomic: of two concurrent requests with the same key, exactly one gets OK.
    const claimed = await this.redis.set(key, JSON.stringify({ status: 'in-progress' }), { condition: 'NX', expiration: { type: 'EX', value: TTL } });
    let outcome: 'charged' | 'replayed' | 'in-progress';
    let response: unknown;

    if (claimed) {
      // Simulated call to the payment provider.
      await sleep(800);
      response = { status: 'succeeded', chargeId: `ch_${randomUUID().slice(0, 8)}`, amount };

      await this.redis.rPush(LEDGER, JSON.stringify({ key: idemKey, ...(response as object) }));
      await this.redis.expire(LEDGER, TTL);
      await this.redis.set(key, JSON.stringify(response), { expiration: { type: 'EX', value: TTL } });
      outcome = 'charged';
    } else {
      response = JSON.parse((await this.redis.get(key)) ?? 'null');
      outcome = (response as { status?: string } | null)?.status === 'in-progress' ? 'in-progress' : 'replayed';

      if (outcome === 'in-progress') res.status(409);
    }

    const ledger = (await this.redis.lRange(LEDGER, 0, -1)).map((e) => JSON.parse(e) as { key: string });

    return { outcome, response, charges: ledger.filter((e) => e.key === idemKey).length, ledger: ledger.slice(-10) };
  }

  // SCAN + UNLINK on the demo prefixes; never touches other pages' keys.
  @Post('reset')
  @HttpCode(200)
  async reset() {
    let deleted = 0;

    for (const match of ['rw:*', 'llm:*']) {
      for await (const keys of this.redis.scanIterator({ MATCH: match, COUNT: 100 })) {
        if (keys.length) deleted += await this.redis.unlink(keys);
      }
    }

    return { deleted };
  }

  private async readSession(key: string) {
    return { session: await this.redis.hGetAll(key), ttl: await this.redis.ttl(key) };
  }
}
