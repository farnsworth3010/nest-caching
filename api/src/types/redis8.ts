import { TIME_SERIES_AGGREGATION_TYPE, TIME_SERIES_BUCKET_TIMESTAMP } from 'redis';
import { attempt, pick, type Demo } from './demo';

const J = { doc: 'demo:json:order', string: 'demo:json:order-string' };
const ORDER = { id: 1001, customer: { name: 'Ada', tier: 'gold' }, items: [{ sku: 'book-42', qty: 1, price: 19.9 }], total: 19.9 };

export const json: Demo = {
  keys: Object.values(J),
  state: async (r) => ({ doc: await r.json.get(J.doc), string: await r.get(J.string) }),
  actions: {
    set: (r) => r.json.set(J.doc, '$', ORDER),
    incr: (r) => r.json.numIncrBy(J.doc, '$.total', 9.99),
    append: (r) => r.json.arrAppend(J.doc, '$.items', { sku: 'pen-7', qty: 2, price: 1.5 }),
    name: (r) => r.json.get(J.doc, { path: '$.customer.name' }),
    // The same update on a plain string: read the whole document, change it in the app, write it all back.
    string: async (r) => {
      await r.set(J.string, JSON.stringify(ORDER), { condition: 'NX' });

      const doc = JSON.parse((await r.get(J.string)) ?? '{}');
      doc.total = Math.round((doc.total + 9.99) * 100) / 100;

      return r.set(J.string, JSON.stringify(doc));
    },
  },
};

const TS = 'demo:ts:temperature';
const MINUTE = 60_000;

export const timeseries: Demo = {
  keys: [TS],
  state: async (r) => {
    if (!(await r.exists(TS))) return { raw: [], avg: [] };

    return {
      raw: await r.ts.range(TS, '-', '+'),
      avg: await r.ts.range(TS, '-', '+', { AGGREGATION: { type: TIME_SERIES_AGGREGATION_TYPE.AVG, timeBucket: 15 * MINUTE, BUCKETTIMESTAMP: TIME_SERIES_BUCKET_TIMESTAMP.MIDDLE } }),
    };
  },
  actions: {
    seed: async (r) => {
      // Starts on a 15-minute boundary so the AVG buckets line up with the raw samples.
      const start = Math.floor(Date.now() / (15 * MINUTE)) * 15 * MINUTE - 120 * MINUTE;
      const samples = Array.from({ length: 120 }, (_, i) => ({ key: TS, timestamp: start + i * MINUTE, value: Math.round((21 + 2 * Math.sin(i / 15) + Math.random() - 0.5) * 100) / 100 }));

      await r.unlink(TS);
      await r.ts.create(TS, { RETENTION: 24 * 60 * MINUTE, LABELS: { sensor: 'kitchen' } });

      return { added: (await r.ts.mAdd(samples)).length };
    },
    add: (r) => r.ts.add(TS, '*', Math.round((20 + Math.random() * 4) * 100) / 100),
  },
};

const P = { bloom: 'demo:bf:usernames', topk: 'demo:topk:pages' };
const NAMES = ['alice', 'bob', 'carol', 'dave'];
const PAGES = ['/home', '/home', '/home', '/home', '/pricing', '/pricing', '/pricing', '/docs', '/docs', '/blog', '/about', '/careers'];

export const probabilistic: Demo = {
  keys: Object.values(P),
  state: async (r) => ({
    bloomItems: (await r.exists(P.bloom)) ? await r.bf.card(P.bloom) : null,
    topk: (await r.exists(P.topk)) ? await r.topK.listWithCount(P.topk) : [],
  }),
  actions: {
    reserve: (r) => attempt(() => r.bf.reserve(P.bloom, 0.01, 1000)),
    signup: (r) => r.bf.add(P.bloom, pick(NAMES)),
    check: async (r) => {
      const names = [...NAMES, 'mallory', 'trent'];
      const found = [];

      for (const name of names) found.push({ name, exists: await r.bf.exists(P.bloom, name) });

      return found;
    },
    pages: async (r) => {
      if (!(await r.exists(P.topk))) await r.topK.reserve(P.topk, 3);

      await r.topK.add(P.topk, Array.from({ length: 200 }, () => pick(PAGES)));

      return r.topK.listWithCount(P.topk);
    },
  },
};

const V = 'demo:vset:colors';
const COLORS: Record<string, number[]> = {
  red: [1, 0, 0],
  orange: [1, 0.5, 0],
  yellow: [1, 1, 0],
  green: [0, 0.8, 0],
  teal: [0, 0.5, 0.5],
  blue: [0, 0, 1],
  purple: [0.5, 0, 0.5],
  pink: [1, 0.4, 0.7],
  brown: [0.6, 0.3, 0.1],
};
const QUERY = { name: 'coral', rgb: [1, 0.5, 0.3] };

export const vector: Demo = {
  keys: [V],
  state: async (r) => {
    const members = (await r.exists(V)) ? ((await r.vRandMember(V, 100)) as string[]) : [];

    return { query: QUERY, members: members.sort().map((name) => ({ name, rgb: COLORS[name] })) };
  },
  actions: {
    seed: async (r) => {
      for (const [name, rgb] of Object.entries(COLORS)) await r.vAdd(V, rgb, name);

      return r.vCard(V);
    },
    similar: (r) => r.vSimWithScores(V, QUERY.rgb, { COUNT: 3 }),
    card: (r) => r.vCard(V),
  },
};
