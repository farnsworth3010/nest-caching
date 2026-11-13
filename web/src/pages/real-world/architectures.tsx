import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { Case, CaseDemoProps } from './types';

const randomKey = () => `order-${Math.random().toString(36).slice(2, 8)}`;

const RICH = { strong: <strong />, code: <code /> };

type SessionRes = { sid: string; session: Record<string, string> | null; ttl: number };

function SessionDemo({ post, busy }: CaseDemoProps) {
  const { t } = useTranslation('realWorld');
  const [user, setUser] = useState('alice');
  const [res, setRes] = useState<SessionRes>();
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const send = async (action: string) => {
    const r = await post<SessionRes>('session', { action, user, sid: res?.sid });
    if (!r) return;

    setRes(r);
    setExpiresAt(r.session ? Date.now() + r.ttl * 1000 : 0);
  };

  const left = Math.max(0, Math.min(res?.ttl ?? 0, Math.ceil((expiresAt - now) / 1000)));

  return (
    <>
      <div className="controls">
        <label>
          {t('session.ui.user')}
          <input value={user} maxLength={32} onChange={(e) => setUser(e.target.value)} />
        </label>
        <div className="buttons">
          <button disabled={busy} onClick={() => send('login')}>
            {t('session.ui.login')}
          </button>
          <button disabled={busy || !res} onClick={() => send('request')}>
            {t('session.ui.request')}
          </button>
          <button disabled={busy || !res} onClick={() => send('logout')}>
            {t('session.ui.logout')}
          </button>
        </div>
      </div>
      {res && (
        <div className="rw-out">
          <p>
            <Trans t={t} i18nKey="session.ui.session" values={{ sid: res.sid }} components={RICH} />{' '}
            {res.session ? (
              <Trans t={t} i18nKey="session.ui.expires" values={{ s: left }} components={RICH} />
            ) : (
              <strong>{t('session.ui.gone')}</strong>
            )}
          </p>
          {res.session && (
            <table className="cheats">
              <tbody>
                {Object.entries(res.session).map(([field, value]) => (
                  <tr key={field}>
                    <td>
                      <code>{field}</code>
                    </td>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}

type Score = { value: string; score: number };
type BoardRes = { top: Score[]; player: { name: string; rank: number | null; score: number | null }; players: string[] };

function LeaderboardDemo({ post, busy }: CaseDemoProps) {
  const { t } = useTranslation('realWorld');
  const [player, setPlayer] = useState('grace');
  const [res, setRes] = useState<BoardRes>();

  const send = async (events: number, name = player) => {
    const r = await post<BoardRes>('leaderboard', { events, player: name });
    if (r) setRes(r);
  };

  useEffect(() => {
    void send(0);
  }, []);

  const max = Math.max(1, ...(res?.top.map((s) => s.score) ?? []));

  return (
    <>
      <div className="controls">
        <label>
          {t('leaderboard.ui.player')}
          <select
            value={player}
            onChange={(e) => {
              setPlayer(e.target.value);
              void send(0, e.target.value);
            }}
          >
            {(res?.players ?? [player]).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <div className="buttons">
          <button disabled={busy} onClick={() => send(50)}>
            {t('leaderboard.ui.events50')}
          </button>
          <button disabled={busy} onClick={() => send(300)}>
            {t('leaderboard.ui.events300')}
          </button>
        </div>
      </div>
      {res && (
        <div className="rw-out">
          <p>
            {res.player.rank === null ? (
              <Trans t={t} i18nKey="leaderboard.ui.noScore" values={{ name: res.player.name }} components={RICH} />
            ) : (
              <Trans t={t} i18nKey="leaderboard.ui.rank" values={{ name: res.player.name, rank: res.player.rank + 1, score: res.player.score }} components={RICH} />
            )}
          </p>
          {res.top.length ? (
            <ol className="bars">
              {res.top.map((s) => (
                <li key={s.value} className={s.value === res.player.name ? 'rw-me' : undefined}>
                  <span>{s.value}</span>
                  <span className="bar" style={{ width: `${(s.score / max) * 100}%` }} />
                  <strong>{s.score}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="hint">{t('leaderboard.ui.empty')}</p>
          )}
        </div>
      )}
    </>
  );
}

type Post = { author: string; text: string; at: number };
type FeedRes = { writes: number; followers: Record<string, string[]>; timelines: { user: string; posts: Post[] }[] };

function FeedDemo({ post, busy }: CaseDemoProps) {
  const { t } = useTranslation('realWorld');
  const [author, setAuthor] = useState('alice');
  const [text, setText] = useState(() => t('feed.ui.defaultText'));
  const [res, setRes] = useState<FeedRes>();

  const send = async (action: 'post' | 'read') => {
    const r = await post<FeedRes>('feed', { action, author, text });
    if (r) setRes(r);
  };

  useEffect(() => {
    void send('read');
  }, []);

  const followers = res
    ? Object.entries(res.followers)
        .map(([a, f]) => `${a} → ${f.join(', ')}`)
        .join('; ')
    : '';

  return (
    <>
      <div className="controls">
        <label>
          {t('feed.ui.author')}
          <select value={author} onChange={(e) => setAuthor(e.target.value)}>
            {['alice', 'bob', 'carol', 'dave', 'celebrity'].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="rw-grow">
          {t('feed.ui.post')}
          <input value={text} maxLength={200} onChange={(e) => setText(e.target.value)} />
        </label>
        <div className="buttons">
          <button disabled={busy} onClick={() => send('post')}>
            {t('feed.ui.publish')}
          </button>
        </div>
      </div>
      {res && (
        <div className="rw-out">
          <p className="hint">{t('feed.ui.followers', { list: followers })}</p>
          {res.writes > 0 && <p className="note">{res.writes === 1 ? t('feed.ui.celebrity') : t('feed.ui.fanout', { count: res.writes })}</p>}
          <div className="rw-timelines">
            {res.timelines.map((tl) => (
              <section key={tl.user}>
                <h3>{t('feed.ui.timeline', { user: tl.user })}</h3>
                {tl.posts.length ? (
                  <ul>
                    {tl.posts.map((p) => (
                      <li key={`${p.at}-${p.author}`} className={p.author === 'celebrity' ? 'rw-merged' : undefined}>
                        <strong>{p.author}</strong> {p.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="hint">{t('feed.ui.empty')}</p>
                )}
              </section>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

type Pending = { id: string; consumer: string; millisecondsSinceLastDelivery: number; deliveriesCounter: number };
type Job = { id: string; job: string };
type QueueResult = { note?: string; added?: string[]; claimedAndDone?: Job[]; minIdleMs?: number; done?: Job[]; crashedOn?: string | null };
type QueueRes = { result: QueueResult; length: number; pending: Pending[] };

function QueueDemo({ post, busy }: CaseDemoProps) {
  const { t } = useTranslation('realWorld');
  const [res, setRes] = useState<QueueRes>();

  const send = async (action: string) => {
    const r = await post<QueueRes>('queue', { action });
    if (r) setRes(r);
  };

  // The API answers with data; the sentence is built here so it follows the page language.
  const describe = (r: QueueResult) => {
    const jobs = (list: Job[] = []) => list.map((j) => j.job).join(', ') || t('queue.ui.none');

    if (r.note) return t('queue.ui.empty');
    if (r.added) return t('queue.ui.added', { count: r.added.length });
    if (r.claimedAndDone) return r.claimedAndDone.length ? t('queue.ui.claimed', { jobs: jobs(r.claimedAndDone) }) : t('queue.ui.notIdle', { s: Number(r.minIdleMs) / 1000 });

    return `${t('queue.ui.done', { jobs: jobs(r.done) })}${r.crashedOn ? ` ${t('queue.ui.crashed', { job: r.crashedOn })}` : ''}`;
  };

  return (
    <>
      <div className="buttons">
        <button disabled={busy} onClick={() => send('enqueue')}>
          {t('queue.ui.enqueue')}
        </button>
        <button disabled={busy} onClick={() => send('work')}>
          {t('queue.ui.work')}
        </button>
        <button disabled={busy} onClick={() => send('crash')}>
          {t('queue.ui.crash')}
        </button>
        <button disabled={busy} onClick={() => send('reclaim')}>
          {t('queue.ui.reclaim')}
        </button>
      </div>
      {res && (
        <div className="rw-out">
          <p className="note">{describe(res.result)}</p>
          <p>{t('queue.ui.length', { length: res.length, pending: res.pending.length })}</p>
          {res.pending.length > 0 && (
            <table className="cheats">
              <thead>
                <tr>
                  <th>{t('queue.ui.pendingId')}</th>
                  <th>{t('queue.ui.owner')}</th>
                  <th>{t('queue.ui.idle')}</th>
                  <th>{t('queue.ui.deliveries')}</th>
                </tr>
              </thead>
              <tbody>
                {res.pending.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.consumer}</td>
                    <td>{t('queue.ui.seconds', { s: (p.millisecondsSinceLastDelivery / 1000).toFixed(1) })}</td>
                    <td>{p.deliveriesCounter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}

type PresenceRes = { removed: number; count: number; online: { user: string; secondsAgo: number }[]; windowMs: number };

function PresenceDemo({ post, busy }: CaseDemoProps) {
  const { t } = useTranslation('realWorld');
  const [user, setUser] = useState('me');
  const [res, setRes] = useState<PresenceRes>();

  const send = async (action: string) => {
    const r = await post<PresenceRes>('presence', { action, user });
    if (r) setRes(r);
  };

  return (
    <>
      <div className="controls">
        <label>
          {t('presence.ui.user')}
          <input value={user} maxLength={32} onChange={(e) => setUser(e.target.value)} />
        </label>
        <div className="buttons">
          <button disabled={busy} onClick={() => send('heartbeat')}>
            {t('presence.ui.heartbeat')}
          </button>
          <button disabled={busy} onClick={() => send('simulate')}>
            {t('presence.ui.simulate')}
          </button>
          <button disabled={busy} onClick={() => send('read')}>
            {t('presence.ui.read')}
          </button>
        </div>
      </div>
      {res && (
        <div className="rw-out">
          <p>
            <Trans t={t} i18nKey="presence.ui.online" values={{ count: res.count, s: res.windowMs / 1000, removed: res.removed }} components={RICH} />
          </p>
          <ul className="rw-chips">
            {res.online.map((o) => (
              <li key={o.user}>
                {o.user} <small>{t('presence.ui.ago', { s: o.secondsAgo })}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

type Outcome = 'charged' | 'replayed' | 'in-progress';
type PaymentRes = { outcome: Outcome; response: { chargeId?: string; status: string }; charges: number; status: number };
type Attempt = PaymentRes & { n: number; key: string };

const BADGE: Record<Outcome, string> = { charged: 'cache', replayed: 'new', 'in-progress': 'db' };

function PaymentDemo({ post, busy }: CaseDemoProps) {
  const { t } = useTranslation('realWorld');
  const [key, setKey] = useState(randomKey);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [charges, setCharges] = useState(0);

  const pay = async (n: number, keep: boolean) => {
    const r = await post<PaymentRes>('payment', { key, amount: 42 }, keep);
    if (!r) return;

    setAttempts((prev) => [{ ...r, n, key }, ...prev].slice(0, 8));
    setCharges(r.charges);
  };

  const sequential = async () => {
    for (let i = 1; i <= 3; i++) await pay(i, i > 1);
  };

  return (
    <>
      <div className="controls">
        <label>
          {t('idempotency.ui.key')}
          <input value={key} maxLength={64} onChange={(e) => setKey(e.target.value)} />
        </label>
        <div className="buttons">
          <button disabled={busy} onClick={() => setKey(randomKey())}>
            {t('idempotency.ui.newKey')}
          </button>
          <button disabled={busy} onClick={() => pay(1, false)}>
            {t('idempotency.ui.once')}
          </button>
          <button disabled={busy} onClick={sequential}>
            {t('idempotency.ui.retries')}
          </button>
          <button disabled={busy} onClick={() => Promise.all([pay(1, false), pay(2, true)])}>
            {t('idempotency.ui.parallel')}
          </button>
        </div>
      </div>
      {attempts.length > 0 && (
        <div className="rw-out">
          <p className="note">{t('idempotency.ui.charged', { count: charges, key })}</p>
          <table className="cheats">
            <thead>
              <tr>
                <th>{t('idempotency.ui.keyCol')}</th>
                <th>{t('idempotency.ui.http')}</th>
                <th>{t('idempotency.ui.outcome')}</th>
                <th>{t('idempotency.ui.response')}</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a, i) => (
                <tr key={i}>
                  <td>{a.key}</td>
                  <td>{a.status}</td>
                  <td>
                    <span className={`badge ${BADGE[a.outcome]}`}>{t(`idempotency.ui.outcomes.${a.outcome}`)}</span>
                  </td>
                  <td>{a.response.chargeId ?? t('idempotency.ui.outcomes.in-progress')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export const architectures: Case[] = [
  {
    id: 'session',
    group: 'Architectures',
    diagram: {
      nodes: [
        { id: 'browser', x: 85, y: 75, kind: 'client' },
        { id: 'app1', x: 330, y: 30, kind: 'app' },
        { id: 'app2', x: 330, y: 120, kind: 'app' },
        { id: 'redis', x: 585, y: 75, kind: 'redis' },
      ],
      edges: [
        ['browser', 'app1'],
        ['browser', 'app2'],
        ['app1', 'redis', true],
        ['app2', 'redis', true],
      ],
    },
    uses: ['HSET rw:session:{sid} user … requests 0', 'EXPIRE rw:session:{sid} 60', 'HINCRBY / HSET / HGETALL', 'DEL rw:session:{sid}'],
    Demo: SessionDemo,
  },
  {
    id: 'leaderboard',
    group: 'Architectures',
    diagram: {
      nodes: [
        { id: 'game', x: 85, y: 35, kind: 'client' },
        { id: 'app', x: 330, y: 35, kind: 'app' },
        { id: 'redis', x: 585, y: 35, kind: 'redis' },
        { id: 'ui', x: 330, y: 125, kind: 'client' },
      ],
      edges: [
        ['game', 'app'],
        ['app', 'redis'],
        ['ui', 'redis'],
      ],
    },
    uses: ['ZINCRBY rw:leaderboard 17 grace', 'ZRANGE rw:leaderboard 0 9 REV WITHSCORES', 'ZREVRANK rw:leaderboard grace', 'ZSCORE rw:leaderboard grace'],
    Demo: LeaderboardDemo,
  },
  {
    id: 'feed',
    group: 'Architectures',
    diagram: {
      nodes: [
        { id: 'author', x: 85, y: 30, kind: 'client' },
        { id: 'celeb', x: 85, y: 120, kind: 'client' },
        { id: 'app', x: 330, y: 75, kind: 'app' },
        { id: 'timelines', x: 585, y: 30, kind: 'redis' },
        { id: 'celebList', x: 585, y: 120, kind: 'redis' },
        { id: 'reader', x: 330, y: 210, kind: 'app' },
      ],
      edges: [
        ['author', 'app'],
        ['celeb', 'app'],
        ['app', 'timelines'],
        ['app', 'celebList'],
        ['reader', 'timelines'],
        ['reader', 'celebList'],
      ],
    },
    uses: ['MULTI, LPUSH, LTRIM 0 49, EXPIRE …, EXEC', 'LRANGE rw:feed:timeline:bob 0 9', 'LRANGE rw:feed:posts:celebrity 0 9'],
    Demo: FeedDemo,
  },
  {
    id: 'queue',
    group: 'Architectures',
    diagram: {
      nodes: [
        { id: 'app', x: 85, y: 75, kind: 'app' },
        { id: 'stream', x: 330, y: 75, kind: 'redis' },
        { id: 'a', x: 585, y: 30, kind: 'worker' },
        { id: 'b', x: 585, y: 120, kind: 'worker' },
      ],
      edges: [
        ['app', 'stream'],
        ['stream', 'a'],
        ['stream', 'b'],
      ],
    },
    uses: [
      'XGROUP CREATE rw:jobs workers 0 MKSTREAM',
      'XADD rw:jobs * job resize-image-1',
      'XREADGROUP GROUP workers worker-a COUNT 3 STREAMS rw:jobs >',
      'XACK rw:jobs workers <id>',
      'XPENDING rw:jobs workers - + 10',
      'XAUTOCLAIM rw:jobs workers worker-b 3000 0-0',
    ],
    Demo: QueueDemo,
  },
  {
    id: 'presence',
    group: 'Architectures',
    diagram: {
      nodes: [
        { id: 'clients', x: 85, y: 75, kind: 'client' },
        { id: 'app', x: 330, y: 75, kind: 'app' },
        { id: 'redis', x: 585, y: 75, kind: 'redis' },
      ],
      edges: [
        ['clients', 'app'],
        ['app', 'redis', true],
      ],
    },
    uses: ['ZADD rw:presence <now> me', 'ZREMRANGEBYSCORE rw:presence -inf <now-30s>', 'ZCOUNT rw:presence <now-30s> +inf', 'ZRANGEBYSCORE rw:presence <now-30s> +inf WITHSCORES'],
    Demo: PresenceDemo,
  },
  {
    id: 'idempotency',
    group: 'Architectures',
    diagram: {
      nodes: [
        { id: 'client', x: 85, y: 75, kind: 'client' },
        { id: 'api', x: 330, y: 75, kind: 'app' },
        { id: 'redis', x: 585, y: 30, kind: 'redis' },
        { id: 'psp', x: 585, y: 120, kind: 'db' },
      ],
      edges: [
        ['client', 'api'],
        ['api', 'redis', true],
        ['api', 'psp'],
      ],
    },
    uses: ['SET rw:idem:{key} {"status":"in-progress"} NX EX 600', 'SET rw:idem:{key} <response> EX 600', 'GET rw:idem:{key}', 'RPUSH rw:payments:ledger …'],
    Demo: PaymentDemo,
  },
];
