import { pick, randomInt, type Demo } from './demo';

const S = { views: 'demo:string:views', flag: 'demo:string:flag', greeting: 'demo:string:greeting', a: 'demo:string:a', b: 'demo:string:b' };

export const string: Demo = {
  keys: Object.values(S),
  state: async (r) => {
    const [views, flag, greeting, a, b] = await r.mGet([S.views, S.flag, S.greeting, S.a, S.b]);

    return { views, flag, flagTtl: await r.ttl(S.flag), greeting, a, b };
  },
  actions: {
    incr: async (r) => ({ incr: await r.incr(S.views), incrBy: await r.incrBy(S.views, 10) }),
    flag: (r) => r.set(S.flag, 'on', { expiration: { type: 'EX', value: 30 }, condition: 'NX' }),
    append: async (r) => {
      await r.set(S.greeting, 'Hello', { condition: 'NX' });

      return r.append(S.greeting, '!');
    },
    mset: async (r) => {
      await r.mSet({ [S.a]: '1', [S.b]: '2' });

      return r.mGet([S.a, S.b]);
    },
    getdel: (r) => r.getDel(S.greeting),
  },
};

const USER = 'demo:hash:user:1';

export const hash: Demo = {
  keys: [USER],
  state: async (r) => ({ fields: await r.hGetAll(USER), otpTtl: (await r.hTTL(USER, 'otp'))?.[0] ?? null }),
  actions: {
    create: (r) => r.hSet(USER, { name: 'Ada', email: 'ada@example.com', visits: 0 }),
    visit: (r) => r.hIncrBy(USER, 'visits', 1),
    get: (r) => r.hGet(USER, 'name'),
    del: (r) => r.hDel(USER, 'email'),
    otp: async (r) => {
      await r.hSet(USER, 'otp', String(100_000 + randomInt(900_000)));

      return r.hExpire(USER, 'otp', 30);
    },
  },
};

const L = { events: 'demo:list:events', queue: 'demo:list:queue', processing: 'demo:list:processing' };

export const list: Demo = {
  keys: Object.values(L),
  state: async (r) => ({ events: await r.lRange(L.events, 0, -1), queue: await r.lRange(L.queue, 0, -1), processing: await r.lRange(L.processing, 0, -1) }),
  actions: {
    event: async (r) => {
      const length = await r.lPush(L.events, `event ${new Date().toISOString().slice(11, 23)}`);

      // LTRIM keeps only the newest 10, so the list never grows.
      return { length, trim: await r.lTrim(L.events, 0, 9) };
    },
    oldest: (r) => r.rPop(L.events),
    enqueue: (r) => r.rPush(L.queue, `job-${randomInt(1000)}`),
    take: (r) => r.lMove(L.queue, L.processing, 'LEFT', 'RIGHT'),
    done: (r) => r.lPop(L.processing),
  },
};

const A = 'demo:set:article:1';
const B = 'demo:set:article:2';

export const set: Demo = {
  keys: [A, B],
  state: async (r) => ({ a: await r.sMembers(A), b: await r.sMembers(B) }),
  actions: {
    seed: async (r) => ({ a: await r.sAdd(A, ['redis', 'cache', 'nosql', 'database']), b: await r.sAdd(B, ['redis', 'streams', 'database', 'queue']) }),
    add: (r) => r.sAdd(A, 'performance'),
    remove: (r) => r.sRem(A, 'cache'),
    check: (r) => r.sIsMember(A, 'redis'),
    ops: async (r) => ({ inter: await r.sInter([A, B]), union: await r.sUnion([A, B]), diff: await r.sDiff([A, B]), card: await r.sCard(A) }),
  },
};

const LB = 'demo:zset:leaderboard';
const PLAYERS = ['alice', 'bob', 'carol', 'dave', 'erin'];

export const zset: Demo = {
  keys: [LB],
  state: (r) => r.zRangeWithScores(LB, 0, -1, { REV: true }),
  actions: {
    seed: (r) => r.zAdd(LB, PLAYERS.map((value, i) => ({ value, score: 120 - i * 20 }))),
    score: (r) => r.zIncrBy(LB, 5 + randomInt(30), pick(PLAYERS)),
    rank: async (r) => ({ zRank: await r.zRank(LB, 'carol'), zRevRank: await r.zRevRank(LB, 'carol') }),
    range: (r) => r.zRangeByScore(LB, 80, '+inf'),
    remove: (r) => r.zRem(LB, 'erin'),
  },
};
