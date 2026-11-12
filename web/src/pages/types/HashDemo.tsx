import type { TypeDemo, ViewProps } from './types';

type State = { fields: Record<string, string>; otpTtl: number | null };

function View({ state }: ViewProps<State>) {
  const fields = Object.entries(state.fields);

  if (!fields.length) return <p>Key demo:hash:user:1 does not exist.</p>;

  return (
    <table className="kv">
      <caption>
        <code>demo:hash:user:1</code>
      </caption>
      <tbody>
        {fields.map(([field, value]) => (
          <tr key={field}>
            <td>
              <code>{field}</code>
            </td>
            <td>{value}</td>
            <td className="hint">{field === 'otp' && state.otpTtl !== null && state.otpTtl > 0 ? `field expires in ${state.otpTtl} s` : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const hash: TypeDemo = {
  id: 'hash',
  title: 'Hash',
  group: 'Core',
  about:
    'A hash is a small map of field → value under one key, like a row or an object. You read and write single fields without touching the rest. Since Redis 7.4 each field can have its own TTL (HEXPIRE), so a one-time code can expire while the profile stays.',
  uses: ['User profiles and sessions', 'Objects whose fields change independently', 'Per-field counters (HINCRBY)'],
  cheats: [
    ['HSET key f v [f v …]', 'Set one or more fields', 'O(N) fields'],
    ['HGET key f', 'Read one field', 'O(1)'],
    ['HGETALL key', 'Read all fields', 'O(N)'],
    ['HINCRBY key f n', 'Atomic counter inside the hash', 'O(1)'],
    ['HDEL key f', 'Remove a field', 'O(1)'],
    ['HEXPIRE key s FIELDS n f', 'TTL for single fields (7.4+)', 'O(N) fields'],
  ],
  actions: [
    ['create', 'HSET profile'],
    ['visit', 'HINCRBY visits'],
    ['get', 'HGET name'],
    ['otp', 'HSET otp + HEXPIRE 30 s'],
    ['del', 'HDEL email'],
  ],
  View,
};
