import type { TypeDemo, ViewProps } from './types';

type State = { views: string | null; flag: string | null; flagTtl: number; greeting: string | null; a: string | null; b: string | null };

function View({ state }: ViewProps<State>) {
  const rows: [string, string | null, string?][] = [
    ['demo:string:views', state.views],
    ['demo:string:flag', state.flag, state.flagTtl > 0 ? `expires in ${state.flagTtl} s` : undefined],
    ['demo:string:greeting', state.greeting],
    ['demo:string:a', state.a],
    ['demo:string:b', state.b],
  ];

  return (
    <table className="kv">
      <tbody>
        {rows.map(([key, value, note]) => (
          <tr key={key}>
            <td>
              <code>{key}</code>
            </td>
            <td>{value ?? <em>(nil)</em>}</td>
            <td className="hint">{note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const string: TypeDemo = {
  id: 'string',
  title: 'String',
  group: 'Core',
  about:
    'The simplest type: a key holds one binary-safe value up to 512 MB. Numbers stored as strings can be incremented atomically, and any key can carry a TTL. SET with NX gives you "only if it does not exist", the base of flags and simple locks.',
  uses: ['Counters (page views, rate limits)', 'Cached values and serialized objects', 'Feature flags and one-time tokens with a TTL'],
  cheats: [
    ['SET key value [EX s] [NX|XX]', 'Write a value, optionally with TTL and a condition', 'O(1)'],
    ['GET key', 'Read the value', 'O(1)'],
    ['INCR / INCRBY key n', 'Atomic counter, creates the key at 0', 'O(1)'],
    ['APPEND key value', 'Append to the end, returns new length', 'O(1)'],
    ['GETDEL key', 'Read and delete in one step', 'O(1)'],
    ['MSET / MGET k1 v1 k2 …', 'Many keys in one round trip', 'O(N)'],
  ],
  actions: [
    ['incr', 'INCR + INCRBY views'],
    ['flag', 'SET flag EX 30 NX'],
    ['append', 'SET NX + APPEND'],
    ['mset', 'MSET + MGET'],
    ['getdel', 'GETDEL greeting'],
  ],
  View,
};
