import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { Case, CaseDemoProps } from './types';

const RICH = { strong: <strong /> };

type CacheRes = { hit: boolean; score: number | null; threshold: number; matched?: string; answer: string; tokens: number; ms: number };
type CacheRow = CacheRes & { question: string };

function SemanticCacheDemo({ post, busy }: CaseDemoProps) {
  const { t } = useTranslation('realWorld');
  const hits = t('semantic-cache.ui.hits', { returnObjects: true });
  const misses = t('semantic-cache.ui.misses', { returnObjects: true });
  const [question, setQuestion] = useState(hits[0]);
  const [rows, setRows] = useState<CacheRow[]>([]);

  const ask = async (q: string) => {
    setQuestion(q);

    const r = await post<CacheRes>('llm/semantic-cache', { question: q });
    if (r) setRows((prev) => [{ ...r, question: q }, ...prev].slice(0, 8));
  };

  return (
    <>
      <div className="controls">
        <label className="rw-grow">
          {t('semantic-cache.ui.question')}
          <input value={question} maxLength={200} onChange={(e) => setQuestion(e.target.value)} />
        </label>
        <div className="buttons">
          <button disabled={busy} onClick={() => ask(question)}>
            {t('semantic-cache.ui.ask')}
          </button>
        </div>
        <p className="hint">{t('semantic-cache.ui.hitsHint')}</p>
        <div className="buttons">
          {hits.map((q) => (
            <button key={q} disabled={busy} onClick={() => ask(q)}>
              {q}
            </button>
          ))}
        </div>
        <p className="hint">{t('semantic-cache.ui.missesHint')}</p>
        <div className="buttons">
          {misses.map((q) => (
            <button key={q} disabled={busy} onClick={() => ask(q)}>
              {q}
            </button>
          ))}
        </div>
      </div>
      {rows.length > 0 && (
        <div className="rw-out">
          <p>
            <Trans t={t} i18nKey="semantic-cache.ui.answer" values={{ answer: rows[0].answer }} components={RICH} />
          </p>
          <table className="cheats">
            <thead>
              <tr>
                <th>{t('semantic-cache.ui.colQuestion')}</th>
                <th>{t('semantic-cache.ui.colScore')}</th>
                <th>{t('semantic-cache.ui.colLatency')}</th>
                <th>{t('semantic-cache.ui.colTokens')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>
                    {r.question}
                    {r.matched && <small className="hint"> ≈ {r.matched}</small>}
                  </td>
                  <td>
                    <span className={`badge ${r.hit ? 'cache' : 'db'}`}>{r.hit ? t('semantic-cache.ui.hit') : t('semantic-cache.ui.miss')}</span>{' '}
                    {r.score === null ? '—' : r.score.toFixed(3)}
                  </td>
                  <td>{t('semantic-cache.ui.ms', { ms: r.ms })}</td>
                  <td>{r.tokens}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

type Message = { role: 'user' | 'assistant'; content: string };
type ChatRes = { prompt: string; reply: string; promptTokens: number; history: Message[]; keep: number; ttl: number };

function ChatDemo({ post, busy }: CaseDemoProps) {
  const { t } = useTranslation('realWorld');
  const [session] = useState(() => `chat-${Math.random().toString(36).slice(2, 8)}`);
  const [message, setMessage] = useState(() => t('chat-memory.ui.first'));
  const [count, setCount] = useState(1);
  const [res, setRes] = useState<ChatRes>();

  const send = async () => {
    const r = await post<ChatRes>('llm/chat', { session, message });
    if (!r) return;

    setRes(r);
    setCount((c) => c + 1);
    setMessage(t('chat-memory.ui.next', { n: count + 1 }));
  };

  return (
    <>
      <div className="controls">
        <label className="rw-grow">
          {t('chat-memory.ui.message', { session })}
          <input value={message} maxLength={200} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <div className="buttons">
          <button disabled={busy} onClick={send}>
            {t('chat-memory.ui.send')}
          </button>
        </div>
      </div>
      {res && (
        <div className="rw-out">
          <p>
            <Trans t={t} i18nKey="chat-memory.ui.reply" values={{ reply: res.reply }} components={RICH} />
          </p>
          <h3>{t('chat-memory.ui.received', { tokens: res.promptTokens })}</h3>
          <pre className="rw-prompt">{res.prompt}</pre>
          <p className="hint">{t('chat-memory.ui.hint', { keep: res.keep, count: res.history.length, ttl: res.ttl })}</p>
        </div>
      )}
    </>
  );
}

type BudgetRes = { allowed: boolean; reserved: number; actual?: number; used: number; limit: number; remaining: number; resetInMs: number; script: string; status: number };

function TokenBudgetDemo({ post, busy }: CaseDemoProps) {
  const { t } = useTranslation('realWorld');
  const [user, setUser] = useState('alice');
  const [prompt, setPrompt] = useState(() => t('token-budget.ui.defaultPrompt'));
  const [rows, setRows] = useState<BudgetRes[]>([]);

  const send = async (keep: boolean) => {
    const r = await post<BudgetRes>('llm/token-budget', { user, prompt }, keep);
    if (r) setRows((prev) => [r, ...prev].slice(0, 10));
  };

  const last = rows[0];

  return (
    <>
      <div className="controls">
        <label>
          {t('token-budget.ui.user')}
          <input value={user} maxLength={32} onChange={(e) => setUser(e.target.value)} />
        </label>
        <label className="rw-grow">
          {t('token-budget.ui.prompt')}
          <input value={prompt} maxLength={200} onChange={(e) => setPrompt(e.target.value)} />
        </label>
        <div className="buttons">
          <button disabled={busy} onClick={() => send(false)}>
            {t('token-budget.ui.send')}
          </button>
          <button disabled={busy} onClick={() => Promise.all(Array.from({ length: 5 }, (_, i) => send(i > 0)))}>
            {t('token-budget.ui.send5')}
          </button>
        </div>
      </div>
      {last && (
        <div className="rw-out">
          <div className="row">
            <h3>{t('token-budget.ui.used', { used: last.used, limit: last.limit })}</h3>
            <span>{t('token-budget.ui.resets', { s: Math.ceil(last.resetInMs / 1000) })}</span>
          </div>
          <div className="meter">
            <div className={last.allowed ? '' : 'over'} style={{ width: `${Math.min(last.used / last.limit, 1) * 100}%` }} />
          </div>
          <table className="cheats">
            <thead>
              <tr>
                <th>{t('token-budget.ui.http')}</th>
                <th>{t('token-budget.ui.reserved')}</th>
                <th>{t('token-budget.ui.actual')}</th>
                <th>{t('token-budget.ui.remaining')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>
                    <span className={`badge ${r.allowed ? 'cache' : 'db'}`}>{r.status}</span>
                  </td>
                  <td>{r.reserved}</td>
                  <td>{r.actual ?? '—'}</td>
                  <td>{r.remaining}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>{t('token-budget.ui.script')}</h3>
          <pre>{last.script}</pre>
        </div>
      )}
    </>
  );
}

type Chunk = { element: string; score: number; doc: string; text: string };
type RagRes = { indexed: number; chunks: Chunk[]; prompt: string; answer: string; promptTokens: number };

function RagDemo({ post, busy }: CaseDemoProps) {
  const { t } = useTranslation('realWorld');
  const questions = t('rag.ui.questions', { returnObjects: true });
  const [question, setQuestion] = useState(questions[0]);
  const [doc, setDoc] = useState('any');
  const [res, setRes] = useState<RagRes>();

  const ask = async (q: string) => {
    setQuestion(q);

    const r = await post<RagRes>('llm/rag', { question: q, doc });
    if (r) setRes(r);
  };

  return (
    <>
      <div className="controls">
        <label className="rw-grow">
          {t('rag.ui.question')}
          <input value={question} maxLength={200} onChange={(e) => setQuestion(e.target.value)} />
        </label>
        <label>
          {t('rag.ui.filter')}
          <select value={doc} onChange={(e) => setDoc(e.target.value)}>
            {['any', 'persistence', 'eviction', 'replication', 'streams'].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <p className="hint">{t('rag.ui.hint')}</p>
        <div className="buttons">
          <button disabled={busy} onClick={() => ask(question)}>
            {t('rag.ui.ask')}
          </button>
          {questions.map((q) => (
            <button key={q} disabled={busy} onClick={() => ask(q)}>
              {q}
            </button>
          ))}
        </div>
      </div>
      {res && (
        <div className="rw-out">
          {res.indexed > 0 && <p className="note">{t('rag.ui.indexed', { count: res.indexed })}</p>}
          <table className="cheats">
            <thead>
              <tr>
                <th>{t('rag.ui.score')}</th>
                <th>{t('rag.ui.doc')}</th>
                <th>{t('rag.ui.chunk')}</th>
              </tr>
            </thead>
            <tbody>
              {res.chunks.map((c) => (
                <tr key={c.element}>
                  <td>{c.score.toFixed(3)}</td>
                  <td>{c.doc}</td>
                  <td>{c.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>{t('rag.ui.prompt', { tokens: res.promptTokens })}</h3>
          <pre className="rw-prompt">{res.prompt}</pre>
          <p>
            <Trans t={t} i18nKey="rag.ui.answer" values={{ answer: res.answer }} components={RICH} />
          </p>
        </div>
      )}
    </>
  );
}

export const llm: Case[] = [
  {
    id: 'semantic-cache',
    group: 'Redis + LLM',
    diagram: {
      nodes: [
        { id: 'user', x: 85, y: 75, kind: 'client' },
        { id: 'app', x: 330, y: 75, kind: 'app' },
        { id: 'redis', x: 585, y: 30, kind: 'redis' },
        { id: 'llm', x: 585, y: 120, kind: 'llm' },
      ],
      edges: [
        ['user', 'app'],
        ['app', 'redis', true],
        ['app', 'llm'],
      ],
    },
    uses: [
      'VSIM llm:semcache VALUES 256 … WITHSCORES COUNT 1',
      'VGETATTR llm:semcache <id>',
      'GET llm:semcache:answer:<id>',
      'VADD llm:semcache VALUES 256 … <id> SETATTR {"question":…}',
      'SET llm:semcache:answer:<id> … EX 300',
    ],
    Demo: SemanticCacheDemo,
  },
  {
    id: 'chat-memory',
    group: 'Redis + LLM',
    diagram: {
      nodes: [
        { id: 'user', x: 85, y: 75, kind: 'client' },
        { id: 'app', x: 330, y: 75, kind: 'app' },
        { id: 'redis', x: 585, y: 30, kind: 'redis' },
        { id: 'llm', x: 585, y: 120, kind: 'llm' },
      ],
      edges: [
        ['user', 'app'],
        ['app', 'redis', true],
        ['app', 'llm'],
      ],
    },
    uses: ['MULTI, RPUSH, LTRIM -6 -1, EXPIRE 900, EXEC', 'LRANGE llm:chat:{session} 0 -1'],
    Demo: ChatDemo,
  },
  {
    id: 'token-budget',
    group: 'Redis + LLM',
    diagram: {
      nodes: [
        { id: 'user', x: 85, y: 75, kind: 'client' },
        { id: 'app', x: 330, y: 75, kind: 'app' },
        { id: 'redis', x: 585, y: 30, kind: 'redis' },
        { id: 'llm', x: 585, y: 120, kind: 'llm' },
      ],
      edges: [
        ['user', 'app'],
        ['app', 'redis', true],
        ['app', 'llm'],
      ],
    },
    uses: ['EVAL <reserve> 1 llm:tokens:alice:<minute> <estimate> 600 60000', 'EVAL <adjust> 1 llm:tokens:alice:<minute> <actual - estimate>'],
    Demo: TokenBudgetDemo,
  },
  {
    id: 'rag',
    group: 'Redis + LLM',
    diagram: {
      nodes: [
        { id: 'docs', x: 85, y: 30, kind: 'db' },
        { id: 'user', x: 85, y: 120, kind: 'client' },
        { id: 'redis', x: 330, y: 75, kind: 'redis' },
        { id: 'app', x: 585, y: 75, kind: 'app' },
        { id: 'llm', x: 585, y: 165, kind: 'llm' },
      ],
      edges: [
        ['docs', 'redis'],
        ['user', 'redis'],
        ['redis', 'app'],
        ['app', 'llm'],
      ],
    },
    uses: [
      'VADD llm:rag:chunks VALUES 256 … eviction:0 SETATTR {"doc":…,"text":…}',
      'VSIM llm:rag:chunks VALUES 256 … WITHSCORES COUNT 3 FILTER \'.doc == "eviction"\'',
      'VGETATTR llm:rag:chunks eviction:0',
    ],
    Demo: RagDemo,
  },
];
