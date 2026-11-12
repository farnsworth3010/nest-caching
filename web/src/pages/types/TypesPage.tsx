import { useEffect, useState } from 'react';
import { api, type Command } from '../../api';
import { CommandsPanel } from '../../CommandsPanel';
import { bitmap } from './BitmapDemo';
import { geo } from './GeoDemo';
import { hash } from './HashDemo';
import { hll } from './HllDemo';
import { json } from './JsonDemo';
import { list } from './ListDemo';
import { probabilistic } from './ProbabilisticDemo';
import { set } from './SetDemo';
import { stream } from './StreamDemo';
import { string } from './StringDemo';
import { timeseries } from './TimeSeriesDemo';
import type { TypeDemo } from './types';
import { vector } from './VectorDemo';
import { zset } from './ZsetDemo';

const DEMOS: TypeDemo[] = [string, hash, list, set, zset, stream, bitmap, hll, geo, json, timeseries, probabilistic, vector];

type Data = { state: unknown; result?: unknown; commands: Command[]; stateFrom: number };

// Remembers which type the data belongs to, so a View never renders another type's state.
type Loaded = Data & { type: string };

export function TypesPage() {
  const [id, setId] = useState(DEMOS[0].id);
  const [loaded, setLoaded] = useState<Loaded>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const demo = DEMOS.find((d) => d.id === id)!;
  const data = loaded?.type === id ? loaded : undefined;

  useEffect(() => {
    let current = true;

    setError(undefined);
    api<Data>(`/types/${id}`).then(
      (res) => current && setLoaded({ ...res, type: id }),
      (err: Error) => current && setError(err.message),
    );

    return () => {
      current = false;
    };
  }, [id]);

  const run = async (action: string) => {
    setBusy(true);
    setError(undefined);

    try {
      setLoaded({ ...(await api<Data>(`/types/${id}/${action}`, { method: 'POST' })), type: id });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1>Redis data types</h1>
      <p className="intro">
        Every Redis 8 data type with a small scenario. Each button runs a fixed set of commands; the panel below lists
        exactly what ran. Pub/Sub is a messaging feature, not a data type (for durable messages use Streams). The Query
        Engine (<code>FT.CREATE</code>, <code>FT.SEARCH</code>) indexes Hash and JSON keys and is not shown here.
      </p>

      <div className="types">
        <aside className="type-list" aria-label="Data types">
          {(['Core', 'Redis 8'] as const).map((group) => (
            <div key={group}>
              <h2>{group}</h2>
              {DEMOS.filter((d) => d.group === group).map((d) => (
                <button key={d.id} aria-current={d.id === id ? 'true' : undefined} onClick={() => setId(d.id)}>
                  {d.title}
                </button>
              ))}
            </div>
          ))}
        </aside>

        <article className="type-demo">
          <h2>{demo.title}</h2>
          <p>{demo.about}</p>
          <ul>
            {demo.uses.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
          <table className="cheats">
            <thead>
              <tr>
                <th>Command</th>
                <th>What it does</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {demo.cheats.map(([cmd, what, cost]) => (
                <tr key={cmd}>
                  <td>
                    <code>{cmd}</code>
                  </td>
                  <td>{what}</td>
                  <td>{cost}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="buttons">
            {demo.actions.map(([action, label]) => (
              <button key={action} disabled={busy} onClick={() => run(action)}>
                {label}
              </button>
            ))}
            <button className="danger" disabled={busy} onClick={() => run('reset')}>
              Reset
            </button>
          </div>
          {error && <p className="error">{error}</p>}

          <section className="card">
            <h2>Current state</h2>
            {data ? <demo.View state={data.state} result={data.result} /> : <p>Loading…</p>}
          </section>
          {data?.result !== undefined && (
            <details className="card result">
              <summary>Last result (after node-redis transforms the reply)</summary>
              <pre>{JSON.stringify(data.result, null, 2)}</pre>
            </details>
          )}
          <CommandsPanel commands={data?.commands ?? []} split={data?.stateFrom} />
        </article>
      </div>
    </>
  );
}
