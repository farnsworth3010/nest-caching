import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { api, type Command } from '../api';
import { CommandsPanel } from '../CommandsPanel';
import './RateLimitPage.i18n';

type Config = { limit: number; windowMs: number; resetInMs: number; script: string };
type Hit = { allowed: boolean; count: number; limit: number; windowMs: number; resetInMs: number; commands: Command[] };
type Point = { t: number; count: number; allowed: boolean };

const SPAN_MS = 15_000;
const W = 720;
const H = 220;
const PAD = 30;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function RateLimitPage() {
  const [cfg, setCfg] = useState<Config>();
  const [client, setClient] = useState('alice');
  const [points, setPoints] = useState<Point[]>([]);
  // Client-clock time when the current window ends, so a skewed server clock does not shift the chart.
  const [windowEnd, setWindowEnd] = useState(0);
  const [count, setCount] = useState(0);
  const [commands, setCommands] = useState<Command[]>([]);
  const [now, setNow] = useState(Date.now());
  const [note, setNote] = useState<string>();
  const [busy, setBusy] = useState(false);
  const { t } = useTranslation('rateLimit');

  useEffect(() => {
    api<Config>('/rate-limit')
      .then((c) => {
        setCfg(c);
        setWindowEnd(Date.now() + c.resetInMs);
      })
      .catch((err: Error) => setNote(err.message));

    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setNote(undefined);

    try {
      await fn();
    } catch (err) {
      setNote((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // api() throws on any non-2xx, but a 429 here is an expected answer with a body.
  const hit = async () => {
    const res = await fetch('/api/rate-limit/hit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client }),
    });
    const body = await res.json();

    if (res.status !== 200 && res.status !== 429) throw new Error(body.message ?? `${res.status} ${res.statusText}`);

    const at = Date.now();
    const h = body as Hit;

    setPoints((prev) => [...prev, { t: at, count: h.count, allowed: h.allowed }]);
    setWindowEnd(at + h.resetInMs);
    setCount(h.count);
    setCommands(h.commands);

    return h;
  };

  const burst = async () => {
    const hits = await Promise.all(Array.from({ length: 20 }, hit));

    setNote(t('notes.burst', { allowed: hits.filter((h) => h.allowed).length }));
  };

  // 20 requests 50 ms apart, from 0.5 s before a window edge to 0.5 s after it.
  const edge = async () => {
    const { resetInMs, windowMs } = await api<Config>('/rate-limit');
    const wait = resetInMs > 800 ? resetInMs - 500 : resetInMs + windowMs - 500;

    setNote(t('notes.waiting', { s: (wait / 1000).toFixed(1) }));
    await sleep(wait);

    const hits = await Promise.all(Array.from({ length: 20 }, (_, i) => sleep(i * 50).then(hit)));

    setNote(t('notes.edge', { allowed: hits.filter((h) => h.allowed).length, limit: cfg?.limit }));
  };

  const limit = cfg?.limit ?? 5;
  const windowMs = cfg?.windowMs ?? 10_000;
  const resetIn = windowEnd ? (((windowEnd - now) % windowMs) + windowMs) % windowMs : 0;
  const current = now < windowEnd ? count : 0;

  const from = now - SPAN_MS;
  const visible = points.filter((p) => p.t >= from);
  const maxY = Math.max(limit * 2, ...visible.map((p) => p.count));
  const x = (t: number) => PAD + ((t - from) / SPAN_MS) * (W - 2 * PAD);
  const y = (n: number) => H - PAD - (n / maxY) * (H - 2 * PAD);
  const edges = windowEnd ? Array.from({ length: Math.ceil(SPAN_MS / windowMs) + 2 }, (_, k) => windowEnd - k * windowMs).filter((t) => t >= from && t <= now) : [];

  return (
    <>
      <h1>{t('title')}</h1>
      <section className="intro">
        <p>
          <Trans t={t} i18nKey="intro.how" values={{ limit, s: windowMs / 1000 }} components={{ code: <code /> }} />
        </p>
        <p>{t('intro.edge')}</p>
        <p>{t('intro.other')}</p>
      </section>

      <section className="card">
        <h2>{t('script.title')}</h2>
        <p className="hint">
          <Trans t={t} i18nKey="script.hint" components={{ code: <code /> }} />
        </p>
        <pre>{cfg?.script}</pre>
      </section>

      <section className="card controls">
        <label>
          {t('controls.client')}
          <input value={client} maxLength={32} onChange={(e) => setClient(e.target.value)} />
        </label>
        <div className="buttons">
          <button disabled={busy} onClick={() => act(async () => void (await hit()))}>
            {t('controls.send')}
          </button>
          <button disabled={busy} onClick={() => act(burst)}>
            {t('controls.burst')}
          </button>
          <button disabled={busy || !cfg} onClick={() => act(edge)}>
            {t('controls.edge')}
          </button>
          <button disabled={busy} onClick={() => setPoints([])}>
            {t('controls.clear')}
          </button>
        </div>
        {note && <p className="note">{note}</p>}
      </section>

      <section className="card">
        <div className="row">
          <h2>{t('counter', { current, limit })}</h2>
          <span>{t('resets', { s: (resetIn / 1000).toFixed(1) })}</span>
        </div>
        <div className="meter">
          <div className={current > limit ? 'over' : ''} style={{ width: `${Math.min(current / limit, 1) * 100}%` }} />
        </div>
      </section>

      <figure className="flow timeline">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('chart.aria')}>
          <line className="axis" x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} />
          <line className="limit" x1={PAD} y1={y(limit)} x2={W - PAD} y2={y(limit)} />
          <text x={PAD + 4} y={y(limit) - 4}>
            {t('chart.limit', { limit })}
          </text>
          {edges.map((t) => (
            <line key={t} className="edge-line" x1={x(t)} y1={PAD / 2} x2={x(t)} y2={H - PAD} />
          ))}
          {visible.map((p, i) => (
            <circle key={i} className={p.allowed ? 'ok' : 'denied'} cx={x(p.t)} cy={y(p.count)} r={4} />
          ))}
          <text x={PAD} y={H - 8}>
            {t('chart.ago', { s: SPAN_MS / 1000 })}
          </text>
          <text x={W - PAD} y={H - 8} textAnchor="end">
            {t('chart.now')}
          </text>
        </svg>
        <figcaption>{t('chart.caption')}</figcaption>
      </figure>

      <CommandsPanel commands={commands} />
    </>
  );
}
