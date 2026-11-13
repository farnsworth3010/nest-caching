import { useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { Command } from '../../api';
import { CommandsPanel } from '../../CommandsPanel';
import { architectures } from './architectures';
import { Diagram } from './Diagram';
import './i18n';
import { llm } from './llm';
import type { CaseId, Post } from './types';

const CASES = [...architectures, ...llm];

const ELSEWHERE = ['cache', 'rate-limit', 'lock', 'replication', 'cluster', 'k8s'] as const;

// Tags the case texts in ./i18n.ts may use.
const RICH = { strong: <strong />, code: <code />, k8s: <a href="#k8s" />, repl: <a href="#replication" />, rl: <a href="#rate-limit" /> };

export function RealWorldPage() {
  const { t } = useTranslation('realWorld');
  const [id, setId] = useState<CaseId>(CASES[0].id);
  const [commands, setCommands] = useState<Command[]>([]);
  const [error, setError] = useState<string>();
  const [note, setNote] = useState<string>();
  const [pending, setPending] = useState(0);
  // Calls that overlap (2 at once) share the panel; a new call after an idle moment starts it over.
  const inFlight = useRef(0);
  const current = CASES.find((c) => c.id === id)!;
  const text = t(id, { returnObjects: true });

  const post: Post = async (path, body, keep = false) => {
    if (!keep && inFlight.current === 0) setCommands([]);

    inFlight.current++;
    setPending((n) => n + 1);
    setError(undefined);
    setNote(undefined);

    try {
      const res = await fetch(`/api/real-world/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => undefined);

      // 409 (payment in progress) and 429 (token budget) are expected answers with a body.
      if (!res.ok && res.status !== 409 && res.status !== 429) throw new Error(`${res.status} ${res.statusText}${data?.message ? `: ${data.message}` : ''}`);

      setCommands((prev) => [...prev, ...data.commands]);

      return { ...data, status: res.status };
    } catch (err) {
      setError((err as Error).message);
    } finally {
      inFlight.current--;
      setPending((n) => n - 1);
    }
  };

  const select = (next: CaseId) => {
    setId(next);
    setCommands([]);
    setError(undefined);
    setNote(undefined);
  };

  const reset = async () => {
    const res = await post<{ deleted: number }>('reset', {});
    if (res) setNote(t('page.resetDone', { count: res.deleted }));
  };

  const busy = pending > 0;
  const nodeLabels: Record<string, string> = text.nodes;
  const diagram = {
    nodes: current.diagram.nodes.map((n) => ({ ...n, label: nodeLabels[n.id] })),
    edges: current.diagram.edges.map(([from, to, both], i) => [from, to, text.edges[i], both] as [string, string, string, boolean | undefined]),
    caption: text.caption,
  };

  return (
    <>
      <h1>{t('page.title')}</h1>
      <p className="intro">
        <Trans t={t} i18nKey="page.intro" components={RICH} />
      </p>

      <div className="types rw">
        <aside className="type-list" aria-label={t('page.cases')}>
          {(['Architectures', 'Redis + LLM'] as const).map((group) => (
            <div key={group}>
              <h2>{t(`page.groups.${group}`)}</h2>
              {CASES.filter((c) => c.group === group).map((c) => (
                <button key={c.id} aria-current={c.id === id ? 'true' : undefined} onClick={() => select(c.id)}>
                  {t(`${c.id}.title`)}
                </button>
              ))}
            </div>
          ))}
          <div className="rw-elsewhere">
            <h2>{t('page.elsewhere')}</h2>
            {ELSEWHERE.map((hash) => (
              <a key={hash} href={`#${hash}`}>
                {t(`page.links.${hash}`)}
              </a>
            ))}
          </div>
          <button className="danger" disabled={busy} onClick={reset}>
            {t('page.reset')}
          </button>
        </aside>

        <article className="type-demo">
          <h2>
            {text.title} {current.group === 'Redis + LLM' && <span className="badge rw-simulated">{t('page.simulated')}</span>}
          </h2>
          <p>
            <strong>{t('page.problem')}</strong> {text.problem}
          </p>
          <p>
            <strong>{t('page.why')}</strong> <Trans t={t} i18nKey={`${id}.why`} components={RICH} />
          </p>
          <Diagram {...diagram} />
          <h3>{t('page.pitfalls')}</h3>
          <ul>
            {text.pitfalls.map((_, i) => (
              <li key={i}>
                <Trans t={t} i18nKey={`${id}.pitfalls.${i}` as `${CaseId}.why`} components={RICH} />
              </li>
            ))}
          </ul>
          <table className="cheats">
            <thead>
              <tr>
                <th>{t('page.command')}</th>
                <th>{t('page.what')}</th>
              </tr>
            </thead>
            <tbody>
              {current.uses.map((cmd, i) => (
                <tr key={cmd}>
                  <td>
                    <code>{cmd}</code>
                  </td>
                  <td>{text.uses[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <section className="card">
            <h2>{t('page.demo')}</h2>
            <current.Demo key={current.id} post={post} busy={busy} />
            {busy && <p className="hint">{t('page.running')}</p>}
            {error && <p className="error">{error}</p>}
            {note && <p className="note">{note}</p>}
          </section>
          <CommandsPanel commands={commands} />
        </article>
      </div>
    </>
  );
}
