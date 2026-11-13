import { useTranslation } from 'react-i18next';
import type { TypeDemo, ViewProps } from './types';

type State = {
  estimate: number;
  exact: number;
  errorPct: number | null;
  hllBytes: number | null;
  setBytes: number | null;
  campaign: number;
  merged: number;
};

function View({ state }: ViewProps<State>) {
  const max = Math.max(state.hllBytes ?? 0, state.setBytes ?? 0, 1);
  const { t, i18n } = useTranslation('types');
  const kb = (bytes: number | null) =>
    bytes === null ? '–' : bytes > 1e6 ? t('hll.mb', { v: (bytes / 1e6).toFixed(2) }) : t('hll.kb', { v: (bytes / 1024).toFixed(1) });

  if (!state.exact) return <p>{t('hll.empty')}</p>;

  return (
    <>
      <dl>
        <dt>{t('hll.estimate')}</dt>
        <dd>{state.estimate.toLocaleString(i18n.language)}</dd>
        <dt>{t('hll.exact')}</dt>
        <dd>{state.exact.toLocaleString(i18n.language)}</dd>
        <dt>{t('hll.error')}</dt>
        <dd>{state.errorPct}%</dd>
        {state.merged > 0 && (
          <>
            <dt>{t('hll.campaign')}</dt>
            <dd>{state.campaign.toLocaleString(i18n.language)}</dd>
            <dt>{t('hll.merged')}</dt>
            <dd>{state.merged.toLocaleString(i18n.language)}</dd>
          </>
        )}
      </dl>
      <h3>{t('hll.memory')}</h3>
      <ol className="bars">
        <li>
          <span>HyperLogLog</span>
          <span className="bar" style={{ width: `${((state.hllBytes ?? 0) / max) * 100}%` }} />
          <strong>{kb(state.hllBytes)}</strong>
        </li>
        <li>
          <span>Set</span>
          <span className="bar" style={{ width: `${((state.setBytes ?? 0) / max) * 100}%` }} />
          <strong>{kb(state.setBytes)}</strong>
        </li>
      </ol>
      {state.hllBytes && state.setBytes && <p className="note">{t('hll.ratio', { count: Math.round(state.setBytes / state.hllBytes) })}</p>}
    </>
  );
}

export const hll: TypeDemo = {
  id: 'hll',
  group: 'Core',
  cheats: [
    'PFADD key item [item …]',
    'PFCOUNT key [key …]',
    'PFMERGE dest k1 k2',
    'MEMORY USAGE key',
  ],
  View,
};
