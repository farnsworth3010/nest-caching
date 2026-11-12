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

const kb = (bytes: number | null) => (bytes === null ? '–' : bytes > 1e6 ? `${(bytes / 1e6).toFixed(2)} MB` : `${(bytes / 1024).toFixed(1)} KB`);

function View({ state }: ViewProps<State>) {
  const max = Math.max(state.hllBytes ?? 0, state.setBytes ?? 0, 1);

  if (!state.exact) return <p>Load 100 000 visitor ids to compare HyperLogLog with an exact Set.</p>;

  return (
    <>
      <dl>
        <dt>PFCOUNT (estimate)</dt>
        <dd>{state.estimate.toLocaleString()}</dd>
        <dt>SCARD (exact)</dt>
        <dd>{state.exact.toLocaleString()}</dd>
        <dt>Error</dt>
        <dd>{state.errorPct}%</dd>
        {state.merged > 0 && (
          <>
            <dt>Campaign (PFCOUNT)</dt>
            <dd>{state.campaign.toLocaleString()}</dd>
            <dt>Merged (PFMERGE)</dt>
            <dd>{state.merged.toLocaleString()}</dd>
          </>
        )}
      </dl>
      <h3>Memory (MEMORY USAGE)</h3>
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
      {state.hllBytes && state.setBytes && <p className="note">The Set takes {Math.round(state.setBytes / state.hllBytes)}× more memory.</p>}
    </>
  );
}

export const hll: TypeDemo = {
  id: 'hll',
  title: 'HyperLogLog',
  group: 'Core',
  about:
    'HyperLogLog counts distinct items without storing them. It never uses more than about 12 KB per key and its count is off by about 0.81% on average. You cannot list or check members, only count them and merge counters.',
  uses: ['Unique visitors, searches, IPs per day', 'Distinct counts across many keys (PFMERGE)', 'Anywhere an exact Set would be too big'],
  cheats: [
    ['PFADD key item [item …]', 'Add items, returns 1 if the estimate changed', 'O(1) per item'],
    ['PFCOUNT key [key …]', 'Estimated distinct count', 'O(1) (cached)'],
    ['PFMERGE dest k1 k2', 'Union of several HLLs', 'O(N) keys'],
    ['MEMORY USAGE key', 'Bytes a key uses', 'O(N) samples'],
  ],
  actions: [
    ['load', 'PFADD + SADD 100 000 ids'],
    ['merge', 'PFADD campaign + PFMERGE'],
  ],
  View,
};
