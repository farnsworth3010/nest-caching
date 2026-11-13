import { useEffect, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { Trans, useTranslation } from 'react-i18next';
import { api, type Command } from '../api';
import { CommandsPanel } from '../CommandsPanel';
import './K8sPage.i18n';

type Pod = { name: string; startedAt?: number; requests?: number; at?: number };
type Pods = { servedBy: string; pods: Pod[]; commands: Command[] };
type Served = { servedBy: string; requests: number; commands: Command[] };
type Sample = { t: number; n: number };
type Probe = { t: number; ok: boolean; node?: string; ms: number };
// Notes are rendered with the current t, so a 30 s probe that ends after a language switch still reads in the new language.
type Note = string | { render: (t: TFunction<'k8s'>) => string };

const POLL_MS = 2_000;
const HISTORY_MS = 5 * 60_000;
const LOAD_S = 60;
const BURN_MS = 200;
const WORKERS = 6;
const W = 720;
const H = 140;
const PAD = 28;
const PROBE_S = 30;
const PROBE_EVERY_MS = 500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// With Sentinel the commands panel labels each command with the Redis node that ran it: "[redis-1] INCR".
const nodeOf = (commands: Command[]) => commands[0]?.cmd.match(/^\[(.+?)\]/)?.[1];

export function K8sPage() {
  const { t, i18n } = useTranslation('k8s');
  const [pods, setPods] = useState<Pods>();
  const [history, setHistory] = useState<Sample[]>([]);
  const [hits, setHits] = useState<Record<string, number>>({});
  const [commands, setCommands] = useState<Command[]>([]);
  const [note, setNote] = useState<Note>();
  const [busy, setBusy] = useState(false);
  const [loadLeft, setLoadLeft] = useState(0);
  const [probes, setProbes] = useState<Probe[]>([]);
  const [probeNote, setProbeNote] = useState<Note>();
  const stop = useRef(false);

  const age = (since: number, now: number) => {
    const s = Math.max(0, Math.round((now - since) / 1000));

    return s < 120 ? t('age.s', { v: s }) : t('age.min', { v: Math.round(s / 60) });
  };

  useEffect(() => {
    let first = true;

    const poll = () =>
      api<Pods>('/k8s/pods')
        .then((p) => {
          setPods(p);
          setHistory((h) => [...h.filter((s) => s.t > Date.now() - HISTORY_MS), { t: Date.now(), n: p.pods.length }]);

          if (first) setCommands(p.commands);
          first = false;
        })
        .catch((err: Error) => setNote(err.message));

    poll();
    const timer = setInterval(poll, POLL_MS);

    return () => {
      clearInterval(timer);
      stop.current = true;
    };
  }, []);

  const count = (res: Served) => setHits((h) => ({ ...h, [res.servedBy]: (h[res.servedBy] ?? 0) + 1 }));

  const ping = async (n: number) => {
    setBusy(true);
    setNote(undefined);
    setHits({});

    try {
      const all = await Promise.all(Array.from({ length: n }, () => api<Served>('/k8s/ping', { method: 'POST' }).then((r) => (count(r), r))));
      const pods = new Set(all.map((r) => r.servedBy)).size;

      setCommands(all[all.length - 1].commands);
      setNote({ render: (t) => t('notes.pinged', { n, count: pods }) });
    } catch (err) {
      setNote((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // WORKERS parallel loops of bounded CPU burns, so the HPA sees average CPU above its target.
  const load = async () => {
    const end = Date.now() + LOAD_S * 1000;
    const tick = setInterval(() => setLoadLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000))), 500);
    let errors = 0;

    stop.current = false;
    setBusy(true);
    setNote(undefined);
    setHits({});
    setLoadLeft(LOAD_S);

    const worker = async () => {
      while (Date.now() < end && !stop.current) {
        try {
          const r = await api<Served>(`/k8s/burn?ms=${BURN_MS}`, { method: 'POST' });

          count(r);
          setCommands(r.commands);
        } catch {
          errors++;
        }
      }
    };

    await Promise.all(Array.from({ length: WORKERS }, worker));

    clearInterval(tick);
    setLoadLeft(0);
    setBusy(false);
    setNote({ render: (t) => (errors ? t('notes.loadDoneErrors', { n: errors }) : t('notes.loadDone')) });
  };

  // One ping every PROBE_EVERY_MS for PROBE_S s, each with a 2 s timeout, while someone deletes the Redis master pod.
  const probe = async () => {
    const end = Date.now() + PROBE_S * 1000;
    const seen: Probe[] = [];

    stop.current = false;
    setBusy(true);
    setProbeNote({ render: (t) => t('failover.probing', { s: PROBE_S }) });
    setProbes([]);

    while (Date.now() < end && !stop.current) {
      const t = Date.now();

      try {
        const r = await api<Served>('/k8s/ping', { method: 'POST', signal: AbortSignal.timeout(2000) });

        seen.push({ t, ok: true, node: nodeOf(r.commands), ms: Date.now() - t });
        setCommands(r.commands);
      } catch {
        seen.push({ t, ok: false, ms: Date.now() - t });
      }

      setProbes([...seen]);
      await sleep(Math.max(0, PROBE_EVERY_MS - (Date.now() - t)));
    }

    const failed = seen.filter((p) => !p.ok);
    const nodes = [...new Set(seen.map((p) => p.node).filter(Boolean))].join(' → ');
    const s = failed.length ? ((failed.at(-1)!.t + failed.at(-1)!.ms - failed[0].t) / 1000).toFixed(1) : '';

    setBusy(false);
    setProbeNote({
      render: (t) => {
        const masters = nodes || t('failover.none');

        return failed.length ? t('failover.summary', { failed: failed.length, total: seen.length, s, masters }) : t('failover.clean', { masters });
      },
    });
  };

  const now = Date.now();
  const list = pods?.pods ?? [];
  const totalHits = Object.values(hits).reduce((a, b) => a + b, 0);
  const maxN = Math.max(5, ...history.map((s) => s.n));
  const from = now - HISTORY_MS;
  const x = (t: number) => PAD + ((t - from) / HISTORY_MS) * (W - 2 * PAD);
  const y = (n: number) => H - PAD - (n / maxN) * (H - 2 * PAD);
  const line = history.map((s) => `${x(s.t)},${y(s.n)}`).join(' ');

  return (
    <>
      <h1>{t('title')}</h1>
      <section className="intro">
        <p>
          <Trans t={t} i18nKey="intro.stateless" components={{ strong: <strong /> }} />
        </p>
        <p>
          <Trans t={t} i18nKey="intro.shutdown" components={{ code: <code />, strong: <strong /> }} />
        </p>
        <p>
          <Trans t={t} i18nKey="intro.hpa" components={{ strong: <strong />, em: <em /> }} />
        </p>
        <p>
          <Trans t={t} i18nKey="intro.statefulSet" components={{ code: <code />, strong: <strong /> }} />
        </p>
        <p>
          <Trans t={t} i18nKey="intro.heartbeat" components={{ code: <code /> }} />
        </p>
      </section>

      <section className="card">
        <div className="row">
          <h2>{t('pods.title', { n: list.length })}</h2>
          <span className="hint">{t('pods.servedBy', { pod: pods?.servedBy ?? '…' })}</span>
        </div>
        <ul className="pods">
          {list.map((p) => (
            <li key={p.name} className={p.name === pods?.servedBy ? 'self' : ''}>
              <strong>{p.name}</strong>
              <span>{t('pods.up', { age: p.startedAt ? age(p.startedAt, now) : '?' })}</span>
              <span>{t('pods.requests', { count: p.requests ?? 0 })}</span>
              {totalHits > 0 && (
                <div className="meter" title={t('pods.share', { n: hits[p.name] ?? 0, total: totalHits })}>
                  <div style={{ width: `${((hits[p.name] ?? 0) / totalHits) * 100}%` }} />
                </div>
              )}
              {totalHits > 0 && <small>{t('pods.lastRun', { n: hits[p.name] ?? 0 })}</small>}
            </li>
          ))}
        </ul>
      </section>

      <section className="card controls">
        <div className="buttons">
          <button disabled={busy} onClick={() => ping(20)}>
            {t('controls.ping', { n: 20 })}
          </button>
          <button disabled={busy} onClick={() => ping(100)}>
            {t('controls.ping', { n: 100 })}
          </button>
          {loadLeft > 0 ? (
            <button className="danger" onClick={() => (stop.current = true)}>
              {t('controls.stop', { s: loadLeft })}
            </button>
          ) : (
            <button disabled={busy} onClick={load}>
              {t('controls.load', { s: LOAD_S })}
            </button>
          )}
        </div>
        <p className="hint">
          <Trans t={t} i18nKey="controls.hint" values={{ workers: WORKERS, ms: BURN_MS, s: LOAD_S }} components={{ code: <code /> }} />
        </p>
        <pre>{`kubectl -n nest-caching get hpa api -w
kubectl -n nest-caching get pods -l app=api -w`}</pre>
        {note && <p className="note">{typeof note === 'string' ? note : note.render(t)}</p>}
      </section>

      <figure className="flow timeline">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('chart.label')}>
          <line className="axis" x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} />
          {[2, 5].map((n) => (
            <g key={n}>
              <line className="limit" x1={PAD} y1={y(n)} x2={W - PAD} y2={y(n)} />
              <text x={PAD + 4} y={y(n) - 4}>
                {n === 2 ? t('chart.min', { n }) : t('chart.max', { n })}
              </text>
            </g>
          ))}
          <polyline className="pod-count" points={line} />
          <text x={PAD} y={H - 8}>
            {t('chart.start')}
          </text>
          <text x={W - PAD} y={H - 8} textAnchor="end">
            {t('chart.now')}
          </text>
        </svg>
        <figcaption>{t('chart.caption')}</figcaption>
      </figure>

      <section className="card">
        <h2>{t('failover.title')}</h2>
        <p>
          <Trans t={t} i18nKey="failover.text" components={{ code: <code /> }} />
        </p>
        <p className="hint">{t('failover.hint')}</p>
        <pre>{`kubectl -n nest-caching exec redis-0 -c sentinel -- redis-cli -p 26379 sentinel get-master-addr-by-name mymaster
kubectl -n nest-caching delete pod redis-0`}</pre>
        <div className="buttons">
          <button disabled={busy} onClick={probe}>
            {t('failover.probe', { s: PROBE_S })}
          </button>
        </div>
        {probes.length > 0 && (
          <ol className="probes" aria-label={t('failover.results')}>
            {probes.map((p) => (
              <li key={p.t} className={p.ok ? 'ok' : 'failed'} title={p.ok ? t('failover.ok', { time: new Date(p.t).toLocaleTimeString(i18n.language), node: p.node ?? '', ms: p.ms }) : t('failover.failed', { time: new Date(p.t).toLocaleTimeString(i18n.language) })}>
                {p.ok ? (p.node ?? '·').replace('redis-', '') : '×'}
              </li>
            ))}
          </ol>
        )}
        {probeNote && <p className="note">{typeof probeNote === 'string' ? probeNote : probeNote.render(t)}</p>}
      </section>

      <section className="card">
        <h2>{t('shared.title')}</h2>
        <p>
          <Trans t={t} i18nKey="shared.text" components={{ rate: <a href="#rate-limit" />, lock: <a href="#lock" /> }} />
        </p>
      </section>

      <CommandsPanel commands={commands} />
    </>
  );
}
