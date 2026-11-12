import type { TypeDemo, ViewProps } from './types';

type State = { events: string[]; queue: string[]; processing: string[] };

function Row({ name, items }: { name: string; items: string[] }) {
  return (
    <div className="list-row">
      <code>{name}</code>
      <div className="boxes">
        <span className="end">head</span>
        {items.length ? items.map((item, i) => <span key={i} className="box">{item}</span>) : <em>(empty)</em>}
        <span className="end">tail</span>
      </div>
    </div>
  );
}

function View({ state }: ViewProps<State>) {
  return (
    <>
      <Row name="demo:list:events (newest first, max 10)" items={state.events} />
      <Row name="demo:list:queue" items={state.queue} />
      <Row name="demo:list:processing" items={state.processing} />
    </>
  );
}

export const list: TypeDemo = {
  id: 'list',
  title: 'List',
  group: 'Core',
  about:
    'A list is a linked list of strings: pushing and popping at either end is O(1), reaching into the middle is O(N). LPUSH + LTRIM keeps a capped "last N" list. LMOVE moves a job from a queue to a processing list atomically, so a crashed worker does not lose it.',
  uses: ['Recent activity feeds (capped with LTRIM)', 'Simple job queues', 'Reliable queues with a processing list (LMOVE)'],
  cheats: [
    ['LPUSH / RPUSH key v', 'Add at head / tail', 'O(1)'],
    ['LPOP / RPOP key', 'Remove from head / tail', 'O(1)'],
    ['LRANGE key start stop', 'Read a range (0 -1 = all)', 'O(S+N)'],
    ['LTRIM key start stop', 'Keep only a range', 'O(N) removed'],
    ['LMOVE src dst LEFT RIGHT', 'Pop from one list, push to another, atomically', 'O(1)'],
  ],
  actions: [
    ['event', 'LPUSH event + LTRIM 0 9'],
    ['oldest', 'RPOP oldest event'],
    ['enqueue', 'RPUSH job'],
    ['take', 'LMOVE queue → processing'],
    ['done', 'LPOP processing'],
  ],
  View,
};
