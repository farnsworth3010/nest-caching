import { useState } from 'react';
import { flushSync } from 'react-dom';
import { Trans, useTranslation } from 'react-i18next';
import { api, type Command } from '../../api';
import { CommandsPanel } from '../../CommandsPanel';
import { FlowDiagram } from './FlowDiagram';
import './i18n';
import { LatencyChart } from './LatencyChart';
import type { ProductResponse, Sample } from './types';

const PRODUCTS = 5000;
const randomId = () => 1 + Math.floor(Math.random() * PRODUCTS);

type Last = ProductResponse & { clientMs: number };
type Stampede = { locked: boolean; dbLoads: number; served: number; totalMs: number };

const STAMPEDE_N = 50;

export function CachePage() {
  const [id, setId] = useState(42);
  const [delay, setDelay] = useState(200);
  const [runs, setRuns] = useState(50);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [last, setLast] = useState<Last>();
  const [commands, setCommands] = useState<Command[]>([]);
  const [note, setNote] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [stampedes, setStampedes] = useState<Stampede[]>([]);
  const { t } = useTranslation('cache');

  // Runs one action at a time and shows its error instead of throwing.
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

  const fetchProduct = async (productId: number) => {
    const start = performance.now();
    const res = await api<ProductResponse>(`/products/${productId}?delay=${delay}`);
    const clientMs = Math.round((performance.now() - start) * 10) / 10;

    // Render now, so chart rendering does not leak into the next request's timing.
    flushSync(() => {
      setLast({ ...res, clientMs });
      setCommands(res.commands);
      setSamples((prev) => [...prev, { n: (prev.at(-1)?.n ?? 0) + 1, id: productId, source: res.source, ms: clientMs }]);
    });
  };

  // A few ids repeated at random: the first request per id misses, the rest hit.
  const runMany = async () => {
    const pool = Array.from({ length: 5 }, randomId);

    for (let i = 0; i < runs; i++) await fetchProduct(pool[Math.floor(Math.random() * pool.length)]);
  };

  const send = async (method: string, path: string, describe: (res: Record<string, unknown>) => string) => {
    const res = await api<Record<string, unknown>>(path, { method });

    setCommands(res.commands);
    setNote(describe(res));
  };

  const stampede = async (locked: boolean) => {
    const res = await api<Omit<Stampede, 'locked'> & { commandCount: number }>(`/cache/stampede?lock=${locked ? 1 : 0}&n=${STAMPEDE_N}&delay=${delay}`, {
      method: 'POST',
    });

    setStampedes((prev) => [...prev.filter((s) => s.locked !== locked), { ...res, locked }]);
    setCommands(res.commands);
    setNote(t('notes.shown', { shown: res.commands.length, total: res.commandCount }));
  };

  return (
    <>
      <h1>{t('title')}</h1>
      <section className="intro">
        <p>{t('intro.how')}</p>
        <p>{t('intro.ttl')}</p>
        <p>
          <Trans t={t} i18nKey="intro.stampede" components={{ a: <a href="#lock" /> }} />
        </p>
        <p className="hint">{t('intro.delay')}</p>
      </section>

      <FlowDiagram source={last?.source} />

      <section className="card controls">
        <label>
          {t('controls.productId')}
          <input type="number" min={1} max={PRODUCTS} value={id} onChange={(e) => setId(e.target.valueAsNumber || 1)} />
        </label>
        <button onClick={() => setId(randomId())}>{t('controls.random')}</button>
        <label className="slider">
          {t('controls.cost', { ms: delay })}
          <input type="range" min={0} max={1000} step={10} value={delay} onChange={(e) => setDelay(e.target.valueAsNumber)} />
        </label>
        <label>
          {t('controls.requests')}
          <input type="number" min={1} max={500} value={runs} onChange={(e) => setRuns(e.target.valueAsNumber || 1)} />
        </label>
        <div className="buttons">
          <button disabled={busy} onClick={() => act(() => fetchProduct(id))}>
            {t('controls.fetch')}
          </button>
          <button disabled={busy} onClick={() => act(runMany)}>
            {t('controls.runMany', { count: runs })}
          </button>
          <button disabled={busy} onClick={() => act(() => send('DELETE', `/cache/products/${id}`, (r) => t('notes.invalidated', { id, count: Number(r.deleted) })))}>
            {t('controls.invalidate')}
          </button>
          <button disabled={busy} onClick={() => act(() => send('POST', '/cache/flush', (r) => t('notes.flushed', { count: Number(r.deleted) })))}>
            {t('controls.flush')}
          </button>
          <button
            className="danger"
            disabled={busy}
            onClick={() => act(() => send('POST', '/cache/flushdb', () => t('notes.flushdb')))}
          >
            FLUSHDB
          </button>
        </div>
        <p className="hint">
          <Trans t={t} i18nKey="controls.flushHint" components={{ code: <code /> }} />
        </p>
        {note && <p className="note">{note}</p>}
      </section>

      <LatencyChart samples={samples} onClear={() => setSamples([])} />

      <section className="card stampede">
        <h2>{t('stampede.title')}</h2>
        <p className="hint">
          <Trans t={t} i18nKey="stampede.hint" values={{ n: STAMPEDE_N }} components={{ code: <code /> }} />
        </p>
        <div className="buttons">
          <button disabled={busy} onClick={() => act(() => stampede(false))}>
            {t('stampede.without')}
          </button>
          <button disabled={busy} onClick={() => act(() => stampede(true))}>
            {t('stampede.with')}
          </button>
        </div>
        {stampedes.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>{t('stampede.mode')}</th>
                <th>{t('stampede.dbLoads')}</th>
                <th>{t('stampede.served')}</th>
                <th>{t('stampede.total')}</th>
              </tr>
            </thead>
            <tbody>
              {stampedes.map((s) => (
                <tr key={String(s.locked)}>
                  <td>{s.locked ? t('stampede.withLock') : t('stampede.withoutLock')}</td>
                  <td className={s.dbLoads > 1 ? 'error' : undefined}>{s.dbLoads}</td>
                  <td>{s.served}</td>
                  <td>{t('ms', { v: s.totalMs })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="columns">
        <section className="card">
          <h2>{t('last.title')}</h2>
          {last ? (
            <>
              <p>
                <span className={`badge ${last.source}`}>{last.source === 'cache' ? t('last.hit') : t('last.miss')}</span>
              </p>
              <dl>
                <dt>{t('last.server')}</dt>
                <dd>{t('ms', { v: last.serverMs })}</dd>
                <dt>{t('last.client')}</dt>
                <dd>{t('ms', { v: last.clientMs })}</dd>
                <dt>TTL</dt>
                <dd>{t('s', { v: last.ttl })}</dd>
              </dl>
              <details>
                <summary>{t('last.json')}</summary>
                <pre>{JSON.stringify(last.product, null, 2)}</pre>
              </details>
            </>
          ) : (
            <p>{t('last.none')}</p>
          )}
        </section>
        <CommandsPanel commands={commands} />
      </div>
    </>
  );
}
