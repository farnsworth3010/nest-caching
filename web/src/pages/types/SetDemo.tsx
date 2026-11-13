import { useTranslation } from 'react-i18next';
import type { TypeDemo, ViewProps } from './types';

type State = { a: string[]; b: string[] };

function Lines({ x, items }: { x: number; items: string[] }) {
  return (
    <text x={x} y={110 - items.length * 9} textAnchor="middle">
      {items.map((item, i) => (
        <tspan key={item} x={x} dy={i ? 18 : 0}>
          {item}
        </tspan>
      ))}
    </text>
  );
}

// Two overlapping circles: members only in A, in both, only in B.
function View({ state }: ViewProps<State>) {
  const both = state.a.filter((m) => state.b.includes(m));
  const onlyA = state.a.filter((m) => !both.includes(m));
  const onlyB = state.b.filter((m) => !both.includes(m));
  const { t } = useTranslation('types');

  return (
    <svg className="venn" viewBox="0 0 420 220" role="img" aria-label={t('set.aria')}>
      <circle cx="150" cy="110" r="95" className="set-a" />
      <circle cx="270" cy="110" r="95" className="set-b" />
      <text x="95" y="20" textAnchor="middle" className="box-label">article:1</text>
      <text x="325" y="20" textAnchor="middle" className="box-label">article:2</text>
      <Lines x={105} items={onlyA} />
      <Lines x={210} items={both} />
      <Lines x={315} items={onlyB} />
    </svg>
  );
}

export const set: TypeDemo = {
  id: 'set',
  group: 'Core',
  cheats: [
    'SADD key m [m …]',
    'SREM key m',
    'SISMEMBER key m',
    'SMEMBERS / SCARD key',
    'SINTER / SUNION / SDIFF k1 k2',
  ],
  View,
};
