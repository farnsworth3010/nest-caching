import { useTranslation } from 'react-i18next';
import type { TypeDemo, ViewProps } from './types';

type State = {
  center: { name: string; longitude: number; latitude: number };
  radiusKm: number;
  points: { member: string; longitude: number; latitude: number }[];
};

const W = 600;
const H = 440;
const PAD = 40;
const KM_PER_DEGREE = 111.2;

// Equirectangular projection fitted to the points and the search circle; good enough at country scale.
function View({ state, result }: ViewProps<State>) {
  const { center, radiusKm, points } = state;
  const { t } = useTranslation('types');
  const cos = Math.cos((center.latitude * Math.PI) / 180);
  const r = radiusKm / KM_PER_DEGREE;
  const xs = [...points.map((p) => p.longitude * cos), center.longitude * cos - r, center.longitude * cos + r];
  const ys = [...points.map((p) => p.latitude), center.latitude - r, center.latitude + r];
  const [minX, maxY] = [Math.min(...xs), Math.max(...ys)];
  const scale = Math.min((W - 2 * PAD) / (Math.max(...xs) - minX), (H - 2 * PAD) / (maxY - Math.min(...ys)));
  const x = (lon: number) => PAD + (lon * cos - minX) * scale;
  const y = (lat: number) => PAD + (maxY - lat) * scale;
  const found = Array.isArray(result) && result.every((item) => 'distance' in item) ? (result as { member: string }[]).map((item) => item.member) : undefined;

  if (!points.length) return <p>{t('geo.empty')}</p>;

  return (
    <figure className="geo">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('geo.aria')}>
        {found && <circle cx={x(center.longitude)} cy={y(center.latitude)} r={r * scale} className="radius" />}
        {points.map((p) => (
          <g key={p.member} className={found?.includes(p.member) ? 'hit' : ''}>
            <circle cx={x(p.longitude)} cy={y(p.latitude)} r="5" />
            <text x={x(p.longitude) + 8} y={y(p.latitude) + 4}>
              {p.member}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>{found ? t('geo.found', { km: radiusKm, center: center.name, found: found.join(', ') }) : t('geo.none')}</figcaption>
    </figure>
  );
}

export const geo: TypeDemo = {
  id: 'geo',
  group: 'Core',
  cheats: [
    'GEOADD key lon lat member …',
    'GEOPOS key member …',
    'GEODIST key m1 m2 km',
    'GEOSEARCH key FROMLONLAT lon lat BYRADIUS r km ASC WITHDIST',
  ],
  View,
};
