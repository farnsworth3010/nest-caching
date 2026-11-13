import { useTranslation } from 'react-i18next';
import type { TypeDemo, ViewProps } from './types';

type State = { bloomItems: number | null; topk: { item: string; count: number }[] };

function View({ state, result }: ViewProps<State>) {
  const { t } = useTranslation('types');
  const checks = Array.isArray(result) && result.every((item) => typeof item === 'object' && 'exists' in item) ? (result as { name: string; exists: boolean }[]) : undefined;

  return (
    <div className="columns">
      <div>
        <h3>{t('probabilistic.bloom')}</h3>
        <p>{state.bloomItems === null ? t('probabilistic.notReserved') : t('probabilistic.added', { n: state.bloomItems })}</p>
        {checks && (
          <ul className="checks">
            {checks.map((c) => (
              <li key={c.name}>
                <code>{c.name}</code> <span className={`badge ${c.exists ? 'pending' : 'acked'}`}>{c.exists ? t('probabilistic.taken') : t('probabilistic.free')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3>{t('probabilistic.topk')}</h3>
        {state.topk.length ? (
          <ol>
            {state.topk.map((top) => (
              <li key={top.item}>
                <code>{top.item}</code> ≈ {top.count}
              </li>
            ))}
          </ol>
        ) : (
          <p>{t('probabilistic.notReserved')}</p>
        )}
      </div>
    </div>
  );
}

export const probabilistic: TypeDemo = {
  id: 'probabilistic',
  group: 'Redis 8',
  cheats: [
    'BF.RESERVE key 0.01 1000',
    'BF.ADD key item',
    'BF.EXISTS key item',
    'TOPK.RESERVE key k',
    'TOPK.ADD key item …',
    'TOPK.LIST key WITHCOUNT',
  ],
  View,
};
