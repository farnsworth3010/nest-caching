import { useTranslation } from 'react-i18next';
import type { TypeDemo, ViewProps } from './types';

type State = { mon: number[]; tue: number[]; both: number[]; counters: number[] };

function Bits({ label, bits }: { label: string; bits: number[] }) {
  const { t } = useTranslation('types');

  return (
    <div className="bitmap">
      <code>{label}</code>
      <div className="bits">
        {bits.map((bit, i) => (
          <span key={i} className={bit ? 'on' : ''} title={t('bitmap.user', { i })} />
        ))}
      </div>
    </div>
  );
}

function View({ state }: ViewProps<State>) {
  const [sat, wrap] = state.counters;
  const { t } = useTranslation('types');

  return (
    <>
      <p className="hint">{t('bitmap.hint')}</p>
      <Bits label="dau:mon" bits={state.mon} />
      <Bits label="dau:tue" bits={state.tue} />
      <Bits label="dau:both (BITOP AND)" bits={state.both} />
      <h3>{t('bitmap.counters')}</h3>
      <ol className="bars">
        <li>
          <span>OVERFLOW SAT</span>
          <span className="bar" style={{ width: `${(sat / 255) * 100}%` }} />
          <strong>{sat}</strong>
        </li>
        <li>
          <span>OVERFLOW WRAP</span>
          <span className="bar" style={{ width: `${(wrap / 255) * 100}%` }} />
          <strong>{wrap}</strong>
        </li>
      </ol>
    </>
  );
}

export const bitmap: TypeDemo = {
  id: 'bitmap',
  group: 'Core',
  cheats: [
    'SETBIT key offset 1',
    'GETBIT key offset',
    'BITCOUNT key',
    'BITOP AND|OR|XOR dest k1 k2',
    'BITFIELD key OVERFLOW SAT INCRBY u8 0 100',
  ],
  View,
};
