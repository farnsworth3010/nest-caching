import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { api, type Command } from '../../api';
import { CommandsPanel } from '../../CommandsPanel';
import { bitmap } from './BitmapDemo';
import { geo } from './GeoDemo';
import { hash } from './HashDemo';
import { hll } from './HllDemo';
import './i18n';
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
  const { t } = useTranslation('types');
  const text = t(id, { returnObjects: true });

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
      <h1>{t('page.title')}</h1>
      <p className="intro">
        <Trans t={t} i18nKey="page.intro" components={{ code: <code /> }} />
      </p>

      <div className="types">
        <aside className="type-list" aria-label={t('page.list')}>
          {(['Core', 'Redis 8'] as const).map((group) => (
            <div key={group}>
              <h2>{t(`page.groups.${group}`)}</h2>
              {DEMOS.filter((d) => d.group === group).map((d) => (
                <button key={d.id} aria-current={d.id === id ? 'true' : undefined} onClick={() => setId(d.id)}>
                  {t(`${d.id}.title`)}
                </button>
              ))}
            </div>
          ))}
        </aside>

        <article className="type-demo">
          <h2>{text.title}</h2>
          <p>{text.about}</p>
          <ul>
            {text.uses.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
          <table className="cheats">
            <thead>
              <tr>
                <th>{t('page.command')}</th>
                <th>{t('page.what')}</th>
                <th>{t('page.cost')}</th>
              </tr>
            </thead>
            <tbody>
              {demo.cheats.map((cmd, i) => (
                <tr key={cmd}>
                  <td>
                    <code>{cmd}</code>
                  </td>
                  <td>{text.cheats[i][0]}</td>
                  <td>{text.cheats[i][1]}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="buttons">
            {Object.entries(text.actions).map(([action, label]) => (
              <button key={action} disabled={busy} onClick={() => run(action)}>
                {label}
              </button>
            ))}
            <button className="danger" disabled={busy} onClick={() => run('reset')}>
              {t('page.reset')}
            </button>
          </div>
          {error && <p className="error">{error}</p>}

          <section className="card">
            <h2>{t('page.state')}</h2>
            {data ? <demo.View state={data.state} result={data.result} /> : <p>{t('page.loading')}</p>}
          </section>
          {data?.result !== undefined && (
            <details className="card result">
              <summary>{t('page.result')}</summary>
              <pre>{JSON.stringify(data.result, null, 2)}</pre>
            </details>
          )}
          <CommandsPanel commands={data?.commands ?? []} split={data?.stateFrom} />
        </article>
      </div>
    </>
  );
}
