import { GEO_REPLY_WITH } from 'redis';
import type { Demo } from './demo';

const KEY = 'demo:geo:cities';
const CENTER = { name: 'Berlin', longitude: 13.405, latitude: 52.52 };
const RADIUS_KM = 600;

const CITIES = [
  { member: 'Berlin', longitude: 13.405, latitude: 52.52 },
  { member: 'Paris', longitude: 2.3522, latitude: 48.8566 },
  { member: 'London', longitude: -0.1276, latitude: 51.5072 },
  { member: 'Amsterdam', longitude: 4.9041, latitude: 52.3676 },
  { member: 'Prague', longitude: 14.4378, latitude: 50.0755 },
  { member: 'Vienna', longitude: 16.3738, latitude: 48.2082 },
  { member: 'Warsaw', longitude: 21.0122, latitude: 52.2297 },
  { member: 'Copenhagen', longitude: 12.5683, latitude: 55.6761 },
  { member: 'Munich', longitude: 11.582, latitude: 48.1351 },
  { member: 'Zurich', longitude: 8.5417, latitude: 47.3769 },
];

export const geo: Demo = {
  keys: [KEY],
  state: async (r) => {
    const members = await r.zRange(KEY, 0, -1);
    const positions = members.length ? await r.geoPos(KEY, members) : [];

    return { center: CENTER, radiusKm: RADIUS_KM, points: members.map((member, i) => ({ member, ...positions[i] })) };
  },
  actions: {
    seed: (r) => r.geoAdd(KEY, CITIES),
    pos: (r) => r.geoPos(KEY, ['Berlin', 'Paris']),
    dist: (r) => r.geoDist(KEY, 'Berlin', 'Paris', 'km'),
    search: (r) => r.geoSearchWith(KEY, CENTER, { radius: RADIUS_KM, unit: 'km' }, [GEO_REPLY_WITH.DISTANCE], { SORT: 'ASC' }),
  },
};
