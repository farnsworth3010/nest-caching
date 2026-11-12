import type { TypeDemo, ViewProps } from './types';

type Color = { name: string; rgb: number[] };
type State = { query: Color; members: Color[] };

const css = (rgb: number[]) => `rgb(${rgb.map((c) => Math.round(c * 255)).join(' ')})`;

function Swatch({ color, score }: { color: Color; score?: number }) {
  return (
    <figure className={`swatch ${score !== undefined ? 'hit' : ''}`}>
      <span style={{ background: css(color.rgb) }} />
      <figcaption>
        {color.name}
        {score !== undefined && <strong> {score.toFixed(3)}</strong>}
      </figcaption>
    </figure>
  );
}

function View({ state, result }: ViewProps<State>) {
  const scores = result && typeof result === 'object' && !Array.isArray(result) ? (result as Record<string, number>) : {};

  return (
    <>
      <div className="swatches">
        <Swatch color={state.query} />
        <span className="hint">query (VSIM) →</span>
      </div>
      {state.members.length ? (
        <div className="swatches">
          {state.members.map((c) => (
            <Swatch key={c.name} color={c} score={scores[c.name]} />
          ))}
        </div>
      ) : (
        <p>The vector set is empty. Run VADD.</p>
      )}
    </>
  );
}

export const vector: TypeDemo = {
  id: 'vector',
  title: 'Vector set',
  group: 'Redis 8',
  about:
    'New in Redis 8: a vector set stores elements with a vector each and finds the most similar ones (HNSW index, cosine similarity). Here the vectors are colors as [r, g, b]. Cosine similarity compares direction, not length, so brown [0.6, 0.3, 0.1] scores closer to coral than orange does.',
  uses: ['Semantic search over embeddings', 'Recommendations ("more like this")', 'Deduplication of near-identical items'],
  cheats: [
    ['VADD key VALUES 3 r g b element', 'Add an element with its vector', 'O(log N)'],
    ['VSIM key VALUES 3 r g b WITHSCORES COUNT 3', 'Most similar elements with scores', 'O(log N)'],
    ['VCARD key', 'Number of elements', 'O(1)'],
  ],
  actions: [
    ['seed', 'VADD 9 colors'],
    ['similar', 'VSIM like coral, top 3'],
    ['card', 'VCARD'],
  ],
  View,
};
