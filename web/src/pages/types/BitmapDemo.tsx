import type { TypeDemo, ViewProps } from './types';

type State = { mon: number[]; tue: number[]; both: number[]; counters: number[] };

function Bits({ label, bits }: { label: string; bits: number[] }) {
  return (
    <div className="bitmap">
      <code>{label}</code>
      <div className="bits">
        {bits.map((bit, i) => (
          <span key={i} className={bit ? 'on' : ''} title={`user ${i}`} />
        ))}
      </div>
    </div>
  );
}

function View({ state }: ViewProps<State>) {
  const [sat, wrap] = state.counters;

  return (
    <>
      <p className="hint">One bit per user id 0–63; a filled cell means the user was active.</p>
      <Bits label="dau:mon" bits={state.mon} />
      <Bits label="dau:tue" bits={state.tue} />
      <Bits label="dau:both (BITOP AND)" bits={state.both} />
      <h3>Bitfield counters (u8, 0–255)</h3>
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
  title: 'Bitmap & bitfield',
  group: 'Core',
  about:
    'Bitmaps are not a separate type: they are bit operations on a String. With one bit per user id, a million users fit in 125 KB, and BITOP combines whole days in one command. BITFIELD packs several small integers into one string and lets you choose what happens on overflow: saturate or wrap around.',
  uses: ['Daily active users and retention (BITOP AND)', 'Feature flags per user id', 'Many tiny counters in one key (BITFIELD)'],
  cheats: [
    ['SETBIT key offset 1', 'Set one bit, returns the old bit', 'O(1)'],
    ['GETBIT key offset', 'Read one bit', 'O(1)'],
    ['BITCOUNT key', 'Count bits set to 1', 'O(N)'],
    ['BITOP AND|OR|XOR dest k1 k2', 'Combine bitmaps into dest', 'O(N)'],
    ['BITFIELD key OVERFLOW SAT INCRBY u8 0 100', 'Typed integer at a bit offset', 'O(1) per op'],
  ],
  actions: [
    ['seed', 'SETBIT 20 users per day'],
    ['login', 'SETBIT tue random user'],
    ['check', 'GETBIT mon 7'],
    ['count', 'BITCOUNT both days'],
    ['and', 'BITOP AND + BITCOUNT'],
    ['counter', 'BITFIELD INCRBY u8 +100'],
  ],
  View,
};
