import { useTranslation } from 'react-i18next';
import type { TypeDemo, ViewProps } from './types';

type State = { value: string; score: number }[];

function View({ state }: ViewProps<State>) {
  const max = Math.max(1, ...state.map((e) => e.score));
  const { t } = useTranslation('types');

  if (!state.length) return <p>{t('zset.empty')}</p>;

  return (
    <ol className="bars">
      {state.map((e) => (
        <li key={e.value}>
          <span>{e.value}</span>
          <span className="bar" style={{ width: `${(e.score / max) * 100}%` }} />
          <strong>{e.score}</strong>
        </li>
      ))}
    </ol>
  );
}

export const zset: TypeDemo = {
  id: 'zset',
  group: 'Core',
  cheats: [
    'ZADD key score m [score m …]',
    'ZINCRBY key n m',
    'ZRANGE key 0 -1 REV WITHSCORES',
    'ZRANK / ZREVRANK key m',
    'ZRANGEBYSCORE key min max',
    'ZREM key m',
  ],
  View,
};
