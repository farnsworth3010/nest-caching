import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { api, type Command } from '../api';
import { CommandsPanel } from '../CommandsPanel';
import './LockPage.i18n';

type Span = { buyer: number; acquiredAt: number; releasedAt: number; result: 'sold' | 'sold out' | 'timeout' };
type Run = { locked: boolean; initial: number; sold: number; finalStock: number; oversold: boolean; timeline: Span[]; commandCount: number };

const W = 720;
const ROW = 7;
const PAD = 30;

function Gantt({ run }: { run: Run }) {
  const rows = [...run.timeline].sort((a, b) => a.acquiredAt - b.acquiredAt);
  const end = Math.max(1, ...rows.map((r) => r.releasedAt));
  const x = (ms: number) => PAD + (ms / end) * (W - 2 * PAD);
  const h = rows.length * ROW + PAD;
  const { t } = useTranslation('lock');
  const kind = (r: Span) => (r.result === 'sold' && run.oversold ? 'oversold' : r.result.replace(' ', '-'));

  return (
    <svg className="gantt" viewBox={`0 0 ${W} ${h}`} role="img" aria-label={run.locked ? t('gantt.with') : t('gantt.without')}>
      {rows.map((r, i) => (
        <g key={r.buyer}>
          {run.locked && <line className="wait" x1={x(0)} y1={i * ROW + ROW / 2} x2={x(r.acquiredAt)} y2={i * ROW + ROW / 2} />}
          <rect className={kind(r)} x={x(r.acquiredAt)} y={i * ROW + 1} width={Math.max(2, x(r.releasedAt) - x(r.acquiredAt))} height={ROW - 2} />
        </g>
      ))}
      <text x={PAD} y={h - 8}>
        {t('gantt.ms', { v: 0 })}
      </text>
      <text x={W - PAD} y={h - 8} textAnchor="end">
        {t('gantt.ms', { v: end })}
      </text>
    </svg>
  );
}

function RunCard({ run }: { run: Run }) {
  const { t } = useTranslation('lock');

  return (
    <section className={`card run ${run.oversold ? 'bad' : 'good'}`}>
      <h2>{run.locked ? t('run.with') : t('run.without')}</h2>
      <dl>
        <dt>{t('run.before')}</dt>
        <dd>{run.initial}</dd>
        <dt>{t('run.sold')}</dt>
        <dd className={run.oversold ? 'error' : undefined}>
          {run.sold}
          {run.oversold && t('run.oversold', { n: run.sold - run.initial })}
        </dd>
        <dt>{t('run.after')}</dt>
        <dd>{run.finalStock}</dd>
        <dt>{t('run.commands')}</dt>
        <dd>{run.commandCount}</dd>
      </dl>
      <Gantt run={run} />
    </section>
  );
}

export function LockPage() {
  const [runs, setRuns] = useState<{ without?: Run; with?: Run }>({});
  const [commands, setCommands] = useState<Command[]>([]);
  const [note, setNote] = useState<string>();
  const [busy, setBusy] = useState(false);
  const { t } = useTranslation('lock');

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

  const reset = async () => {
    const res = await api<{ stock: number }>('/lock/stock/reset', { method: 'POST' });

    setCommands(res.commands);
    setNote(t('notes.reset', { stock: res.stock }));
  };

  // Every run starts from a full stock, so the two runs compare like for like.
  const buy = async (locked: boolean) => {
    await api('/lock/stock/reset', { method: 'POST' });

    const res = await api<Run>(`/lock/stock/buy?lock=${locked ? 1 : 0}`, { method: 'POST' });

    setRuns((prev) => ({ ...prev, [locked ? 'with' : 'without']: res }));
    setCommands(res.commands);
    setNote(t('notes.shown', { shown: res.commands.length, total: res.commandCount }));
  };

  return (
    <>
      <h1>{t('title')}</h1>
      <section className="intro">
        <p>{t('intro.race')}</p>
        <p>
          <Trans t={t} i18nKey="intro.how" components={{ code: <code /> }} />
        </p>
        <p>{t('intro.fencing')}</p>
      </section>

      <section className="card controls">
        <div className="buttons">
          <button disabled={busy} onClick={() => act(() => buy(false))}>
            {t('controls.without')}
          </button>
          <button disabled={busy} onClick={() => act(() => buy(true))}>
            {t('controls.with')}
          </button>
          <button disabled={busy} onClick={() => act(reset)}>
            {t('controls.reset')}
          </button>
        </div>
        <p className="hint">
          <Trans t={t} i18nKey="controls.hint" components={{ code: <code /> }} />
        </p>
        {note && <p className="note">{note}</p>}
      </section>

      {runs.without && <RunCard run={runs.without} />}
      {runs.with && <RunCard run={runs.with} />}
      {(runs.without || runs.with) && (
        <p className="hint legend">
          {t('legend.text')} <span className="sold">{t('legend.sold')}</span> <span className="oversold">{t('legend.oversold')}</span>{' '}
          <span className="sold-out">{t('legend.soldOut')}</span>
        </p>
      )}

      <CommandsPanel commands={commands} />
    </>
  );
}
