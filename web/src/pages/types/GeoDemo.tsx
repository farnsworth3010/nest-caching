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
  const cos = Math.cos((center.latitude * Math.PI) / 180);
  const r = radiusKm / KM_PER_DEGREE;
  const xs = [...points.map((p) => p.longitude * cos), center.longitude * cos - r, center.longitude * cos + r];
  const ys = [...points.map((p) => p.latitude), center.latitude - r, center.latitude + r];
  const [minX, maxY] = [Math.min(...xs), Math.max(...ys)];
  const scale = Math.min((W - 2 * PAD) / (Math.max(...xs) - minX), (H - 2 * PAD) / (maxY - Math.min(...ys)));
  const x = (lon: number) => PAD + (lon * cos - minX) * scale;
  const y = (lat: number) => PAD + (maxY - lat) * scale;
  const found = Array.isArray(result) && result.every((item) => 'distance' in item) ? (result as { member: string }[]).map((item) => item.member) : undefined;

  if (!points.length) return <p>No cities yet. Run GEOADD.</p>;

  return (
    <figure className="geo">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cities and the search radius">
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
      <figcaption>{found ? `GEOSEARCH within ${radiusKm} km of ${center.name}: ${found.join(', ')}` : 'Run GEOSEARCH to draw the radius.'}</figcaption>
    </figure>
  );
}

export const geo: TypeDemo = {
  id: 'geo',
  title: 'Geo',
  group: 'Core',
  about:
    'Geo commands store longitude/latitude pairs inside a sorted set (the score is a geohash). Redis computes distances and finds members within a radius or a box, sorted by distance, so "what is near me" is one command.',
  uses: ['Nearby stores, drivers, restaurants', 'Distance between two places', 'Geo-fencing checks'],
  cheats: [
    ['GEOADD key lon lat member …', 'Add places', 'O(log N) each'],
    ['GEOPOS key member …', 'Coordinates of members', 'O(1) each'],
    ['GEODIST key m1 m2 km', 'Distance between two members', 'O(1)'],
    ['GEOSEARCH key FROMLONLAT lon lat BYRADIUS r km ASC WITHDIST', 'Members within a radius, nearest first', 'O(N + log M)'],
  ],
  actions: [
    ['seed', 'GEOADD 10 cities'],
    ['pos', 'GEOPOS Berlin Paris'],
    ['dist', 'GEODIST Berlin Paris'],
    ['search', 'GEOSEARCH 600 km of Berlin'],
  ],
  View,
};
