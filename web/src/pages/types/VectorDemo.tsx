import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('types');
  const scores = result && typeof result === 'object' && !Array.isArray(result) ? (result as Record<string, number>) : {};

  return (
    <>
      <div className="swatches">
        <Swatch color={state.query} />
        <span className="hint">{t('vector.query')}</span>
      </div>
      {state.members.length ? (
        <div className="swatches">
          {state.members.map((c) => (
            <Swatch key={c.name} color={c} score={scores[c.name]} />
          ))}
        </div>
      ) : (
        <p>{t('vector.empty')}</p>
      )}
    </>
  );
}

export const vector: TypeDemo = {
  id: 'vector',
  group: 'Redis 8',
  cheats: [
    'VADD key VALUES 3 r g b element',
    'VSIM key VALUES 3 r g b WITHSCORES COUNT 3',
    'VCARD key',
  ],
  View,
};
