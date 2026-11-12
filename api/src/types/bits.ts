import type { Redis } from '../redis/redis.module';
import { chunk, randomInt, type Demo } from './demo';

const B = { mon: 'demo:bitmap:dau:mon', tue: 'demo:bitmap:dau:tue', both: 'demo:bitmap:dau:both', counters: 'demo:bitmap:counters' };
const USERS = 64;

// Reads 64 bits as eight u8 values in one BITFIELD_RO call, then unpacks them (offset 0 is the top bit).
async function bits(r: Redis, key: string) {
  const bytes = await r.bitFieldRo(key, Array.from({ length: USERS / 8 }, (_, i) => ({ encoding: 'u8' as const, offset: i * 8 })));

  return bytes.flatMap((byte) => Array.from({ length: 8 }, (_, j) => (Number(byte) >> (7 - j)) & 1));
}

export const bitmap: Demo = {
  keys: Object.values(B),
  state: async (r) => ({
    mon: await bits(r, B.mon),
    tue: await bits(r, B.tue),
    both: await bits(r, B.both),
    counters: await r.bitFieldRo(B.counters, [
      { encoding: 'u8', offset: 0 },
      { encoding: 'u8', offset: 8 },
    ]),
  }),
  actions: {
    seed: async (r) => {
      const day = (key: string) => Promise.all(Array.from({ length: 20 }, () => r.setBit(key, randomInt(USERS), 1)));

      await day(B.mon);
      await day(B.tue);

      return 'random 20 logins per day';
    },
    login: (r) => r.setBit(B.tue, randomInt(USERS), 1),
    check: (r) => r.getBit(B.mon, 7),
    count: async (r) => ({ mon: await r.bitCount(B.mon), tue: await r.bitCount(B.tue) }),
    and: async (r) => ({ bitop: await r.bitOp('AND', B.both, [B.mon, B.tue]), bothDays: await r.bitCount(B.both) }),
    counter: (r) =>
      r.bitField(B.counters, [
        { operation: 'OVERFLOW', behavior: 'SAT' },
        { operation: 'INCRBY', encoding: 'u8', offset: 0, increment: 100 },
        { operation: 'OVERFLOW', behavior: 'WRAP' },
        { operation: 'INCRBY', encoding: 'u8', offset: 8, increment: 100 },
      ]),
  },
};

const H = { visitors: 'demo:hll:visitors', exact: 'demo:hll:visitors-set', campaign: 'demo:hll:campaign', all: 'demo:hll:all' };

const visitorIds = (count: number, from: number, span: number) => Array.from({ length: count }, () => `v${from + randomInt(span)}`);

export const hll: Demo = {
  keys: Object.values(H),
  state: async (r) => {
    const estimate = await r.pfCount(H.visitors);
    const exact = await r.sCard(H.exact);

    return {
      estimate,
      exact,
      errorPct: exact ? Math.round(((estimate - exact) / exact) * 10_000) / 100 : null,
      hllBytes: await r.memoryUsage(H.visitors),
      setBytes: await r.memoryUsage(H.exact, { SAMPLES: 0 }),
      campaign: await r.pfCount(H.campaign),
      merged: await r.pfCount(H.all),
    };
  },
  actions: {
    load: async (r) => {
      const batches = chunk(visitorIds(100_000, 0, 150_000), 1000);

      await r.unlink([H.visitors, H.exact]);
      // Same ids into an HLL and an exact Set, so the page can compare count and memory.
      await Promise.all(batches.map((ids) => r.pfAdd(H.visitors, ids)));
      await Promise.all(batches.map((ids) => r.sAdd(H.exact, ids)));

      return { added: 100_000, batches: batches.length };
    },
    merge: async (r) => {
      await Promise.all(chunk(visitorIds(20_000, 140_000, 20_000), 1000).map((ids) => r.pfAdd(H.campaign, ids)));

      return { pfmerge: await r.pfMerge(H.all, [H.visitors, H.campaign]), merged: await r.pfCount(H.all) };
    },
  },
};
