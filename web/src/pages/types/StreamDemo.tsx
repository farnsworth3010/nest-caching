import type { TypeDemo, ViewProps } from './types';

type Entry = { id: string; message: Record<string, string>; status: 'new' | 'pending' | 'acked'; consumer: string | null };
type State = { group: { name: string; lastDelivered: string; pending: number } | null; entries: Entry[] };

function View({ state }: ViewProps<State>) {
  if (!state.entries.length) return <p>Stream demo:stream:orders is empty.</p>;

  return (
    <>
      <p className="hint">
        {state.group
          ? `Group "${state.group.name}": last delivered ${state.group.lastDelivered}, ${state.group.pending} pending.`
          : 'No consumer group yet.'}
      </p>
      <table className="stream">
        <thead>
          <tr>
            <th>Entry id</th>
            <th>Fields</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {state.entries.map((e) => (
            <tr key={e.id}>
              <td>
                <code>{e.id}</code>
              </td>
              <td>{Object.entries(e.message).map(([k, v]) => `${k}=${v}`).join(' ')}</td>
              <td>
                <span className={`badge ${e.status}`}>{e.status === 'pending' ? `pending · ${e.consumer}` : e.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export const stream: TypeDemo = {
  id: 'stream',
  title: 'Stream',
  group: 'Core',
  about:
    'A stream is an append-only log of entries with time-based ids. Consumer groups split the entries between workers: each entry goes to one consumer and stays pending until it is acknowledged, so a crashed worker\'s entries can be reclaimed. Unlike Pub/Sub, entries are stored and can be re-read.',
  uses: ['Event sourcing and audit logs', 'Work queues with acknowledgements', 'Fan-out to several independent consumer groups'],
  cheats: [
    ['XADD key * f v …', 'Append an entry, * = auto id', 'O(1)'],
    ['XRANGE key - +', 'Read entries by id range', 'O(N)'],
    ['XLEN key', 'Number of entries', 'O(1)'],
    ['XGROUP CREATE key g 0 MKSTREAM', 'Create a consumer group from the start', 'O(1)'],
    ['XREADGROUP GROUP g c COUNT n STREAMS key >', 'Get new entries for consumer c', 'O(M)'],
    ['XACK key g id', 'Mark an entry as processed', 'O(1)'],
    ['XPENDING key g', 'Delivered but not acknowledged', 'O(N)'],
  ],
  actions: [
    ['add', 'XADD 3 orders'],
    ['group', 'XGROUP CREATE'],
    ['read-a', 'XREADGROUP worker-a'],
    ['read-b', 'XREADGROUP worker-b'],
    ['ack', 'XACK oldest pending'],
    ['pending', 'XPENDING summary'],
  ],
  View,
};
