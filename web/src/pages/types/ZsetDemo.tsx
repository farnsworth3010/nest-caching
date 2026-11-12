import type { TypeDemo, ViewProps } from './types';

type State = { value: string; score: number }[];

function View({ state }: ViewProps<State>) {
  const max = Math.max(1, ...state.map((e) => e.score));

  if (!state.length) return <p>Leaderboard is empty.</p>;

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
  title: 'Sorted set',
  group: 'Core',
  about:
    'A sorted set keeps unique members ordered by a numeric score. Updating a score re-sorts in O(log N), and range queries by rank or by score are fast, which makes it the classic leaderboard and priority structure.',
  uses: ['Leaderboards and rankings', 'Priority queues and scheduled jobs (score = timestamp)', 'Sliding-window rate limiters (phase 3)'],
  cheats: [
    ['ZADD key score m [score m …]', 'Add or update members', 'O(log N)'],
    ['ZINCRBY key n m', 'Add to a score', 'O(log N)'],
    ['ZRANGE key 0 -1 REV WITHSCORES', 'Top members, highest first', 'O(log N + M)'],
    ['ZRANK / ZREVRANK key m', 'Position from the bottom / top', 'O(log N)'],
    ['ZRANGEBYSCORE key min max', 'Members with score in a range', 'O(log N + M)'],
    ['ZREM key m', 'Remove a member', 'O(log N)'],
  ],
  actions: [
    ['seed', 'ZADD 5 players'],
    ['score', 'ZINCRBY random player'],
    ['rank', 'ZRANK + ZREVRANK carol'],
    ['range', 'ZRANGEBYSCORE 80 +inf'],
    ['remove', 'ZREM erin'],
  ],
  View,
};
