import { useState } from 'react';
import { flushSync } from 'react-dom';
import { api, type Command } from '../../api';
import { CommandsPanel } from '../../CommandsPanel';
import { FlowDiagram } from './FlowDiagram';
import { LatencyChart } from './LatencyChart';
import type { ProductResponse, Sample } from './types';

const PRODUCTS = 5000;
const randomId = () => 1 + Math.floor(Math.random() * PRODUCTS);

type Last = ProductResponse & { clientMs: number };

export function CachePage() {
  const [id, setId] = useState(42);
  const [delay, setDelay] = useState(200);
  const [runs, setRuns] = useState(50);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [last, setLast] = useState<Last>();
  const [commands, setCommands] = useState<Command[]>([]);
  const [note, setNote] = useState<string>();
  const [busy, setBusy] = useState(false);

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

  return (
    <>
      <h1>Cache-aside</h1>
      <section className="intro">
        <p>
          With cache-aside the application owns the cache. On a read it first asks Redis; on a hit it returns the cached
          value, on a miss it queries the database, stores the result in Redis with a TTL and returns it.
        </p>
        <p>
          The TTL bounds how stale a cached value can get. When data changes, the writer deletes (invalidates) the key, so
          the next read misses and loads fresh data.
        </p>
        <p>
          Beware of a cache stampede: when a hot key expires, many requests miss at once and all hit the database. A lock
          around the reload fixes it, see the Lock page.
        </p>
        <p className="hint">
          The database here is local SQLite, so the slider adds an artificial delay to each miss to simulate network
          latency to a remote database.
        </p>
      </section>

      <FlowDiagram source={last?.source} />

      <section className="card controls">
        <label>
          Product id
          <input type="number" min={1} max={PRODUCTS} value={id} onChange={(e) => setId(e.target.valueAsNumber || 1)} />
        </label>
        <button onClick={() => setId(randomId())}>Random</button>
        <label className="slider">
          DB delay: {delay} ms
          <input type="range" min={0} max={1000} step={10} value={delay} onChange={(e) => setDelay(e.target.valueAsNumber)} />
        </label>
        <label>
          Requests
          <input type="number" min={1} max={500} value={runs} onChange={(e) => setRuns(e.target.valueAsNumber || 1)} />
        </label>
        <div className="buttons">
          <button disabled={busy} onClick={() => act(() => fetchProduct(id))}>
            Fetch
          </button>
          <button disabled={busy} onClick={() => act(runMany)}>
            Run {runs} requests
          </button>
          <button disabled={busy} onClick={() => act(() => send('DELETE', `/cache/products/${id}`, (r) => `Invalidated product:${id} (${r.deleted} key).`))}>
            Invalidate this key
          </button>
          <button disabled={busy} onClick={() => act(() => send('POST', '/cache/flush', (r) => `Flushed ${r.deleted} cache keys.`))}>
            Flush cache
          </button>
          <button
            className="danger"
            disabled={busy}
            onClick={() => act(() => send('POST', '/cache/flushdb', () => 'FLUSHDB done: every key in the database is gone.'))}
          >
            FLUSHDB
          </button>
        </div>
        <p className="hint">
          Flush cache deletes only <code>product:*</code> keys with SCAN + UNLINK. FLUSHDB wipes every demo key, including
          other pages' data.
        </p>
        {note && <p className="note">{note}</p>}
      </section>

      <LatencyChart samples={samples} onClear={() => setSamples([])} />

      <div className="columns">
        <section className="card">
          <h2>Last response</h2>
          {last ? (
            <>
              <p>
                <span className={`badge ${last.source}`}>{last.source === 'cache' ? 'cache hit' : 'db (miss)'}</span>
              </p>
              <dl>
                <dt>Server</dt>
                <dd>{last.serverMs} ms</dd>
                <dt>Client</dt>
                <dd>{last.clientMs} ms</dd>
                <dt>TTL</dt>
                <dd>{last.ttl} s</dd>
              </dl>
              <details>
                <summary>Product JSON</summary>
                <pre>{JSON.stringify(last.product, null, 2)}</pre>
              </details>
            </>
          ) : (
            <p>No request yet.</p>
          )}
        </section>
        <CommandsPanel commands={commands} />
      </div>
    </>
  );
}
