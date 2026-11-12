import type { TypeDemo, ViewProps } from './types';

type State = { bloomItems: number | null; topk: { item: string; count: number }[] };

function View({ state, result }: ViewProps<State>) {
  const checks = Array.isArray(result) && result.every((item) => typeof item === 'object' && 'exists' in item) ? (result as { name: string; exists: boolean }[]) : undefined;

  return (
    <div className="columns">
      <div>
        <h3>Bloom filter: usernames</h3>
        <p>{state.bloomItems === null ? 'Not reserved yet.' : `Items added: ${state.bloomItems}`}</p>
        {checks && (
          <ul className="checks">
            {checks.map((c) => (
              <li key={c.name}>
                <code>{c.name}</code> <span className={`badge ${c.exists ? 'pending' : 'acked'}`}>{c.exists ? 'maybe taken' : 'definitely free'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3>Top-K: most visited pages (k = 3)</h3>
        {state.topk.length ? (
          <ol>
            {state.topk.map((t) => (
              <li key={t.item}>
                <code>{t.item}</code> ≈ {t.count}
              </li>
            ))}
          </ol>
        ) : (
          <p>Not reserved yet.</p>
        )}
      </div>
    </div>
  );
}

export const probabilistic: TypeDemo = {
  id: 'probabilistic',
  title: 'Probabilistic',
  group: 'Redis 8',
  about:
    'A Bloom filter answers "have I seen this?" in a few bits per item: "no" is always right, "yes" can be wrong with the error rate you choose. Top-K keeps the k most frequent items of a stream in fixed memory, with approximate counts.',
  uses: ['"Username taken?" or "seen this URL?" before a slow DB lookup', 'Spam and fraud pre-filters', 'Trending items (Top-K), frequency estimates (Count-Min Sketch)'],
  cheats: [
    ['BF.RESERVE key 0.01 1000', 'Create a filter: 1% errors at 1 000 items', 'O(1)'],
    ['BF.ADD key item', 'Add an item', 'O(k) hashes'],
    ['BF.EXISTS key item', '0 = definitely not, 1 = maybe', 'O(k) hashes'],
    ['TOPK.RESERVE key k', 'Track the k most frequent items', 'O(1)'],
    ['TOPK.ADD key item …', 'Count items, returns any item pushed out', 'O(k) per item'],
    ['TOPK.LIST key WITHCOUNT', 'Current top k with counts', 'O(k)'],
  ],
  actions: [
    ['reserve', 'BF.RESERVE'],
    ['signup', 'BF.ADD random user'],
    ['check', 'BF.EXISTS 6 names'],
    ['pages', 'TOPK.ADD 200 page views'],
  ],
  View,
};
