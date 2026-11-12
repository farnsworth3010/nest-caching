import { attempt, randomInt, type Demo } from './demo';

const KEY = 'demo:stream:orders';
const GROUP = 'shipping';

// Stream ids are "<ms>-<seq>"; compare both parts numerically.
const after = (a: string, b: string) => {
  const [am, as] = a.split('-').map(Number);
  const [bm, bs] = b.split('-').map(Number);

  return am > bm || (am === bm && as > bs);
};

const read = (consumer: string) => (r: Parameters<Demo['state']>[0]) => r.xReadGroup(GROUP, consumer, { key: KEY, id: '>' }, { COUNT: 2 });

export const stream: Demo = {
  keys: [KEY],
  state: async (r) => {
    const entries = (await r.xRange(KEY, '-', '+')) ?? [];
    const groups = entries.length ? ((await r.xInfoGroups(KEY)) as unknown as Record<string, unknown>[]) : [];
    const group = groups.find((g) => g.name === GROUP);
    const pending = group ? await r.xPendingRange(KEY, GROUP, '-', '+', 100) : [];
    const lastDelivered = group ? String(group['last-delivered-id']) : undefined;

    return {
      group: group ? { name: GROUP, lastDelivered, pending: pending.length } : null,
      entries: entries.map(({ id, message }) => {
        const owner = pending.find((p) => p.id === id)?.consumer;
        const status = owner ? 'pending' : lastDelivered && !after(id, lastDelivered) ? 'acked' : 'new';

        return { id, message, status, consumer: owner ?? null };
      }),
    };
  },
  actions: {
    add: async (r) => {
      const ids = [];

      for (let i = 0; i < 3; i++) ids.push(await r.xAdd(KEY, '*', { order: String(1000 + randomInt(9000)), status: 'created', amount: (5 + randomInt(9500) / 100).toFixed(2) }));

      return { ids, length: await r.xLen(KEY) };
    },
    group: (r) => attempt(() => r.xGroupCreate(KEY, GROUP, '0', { MKSTREAM: true })),
    'read-a': read('worker-a'),
    'read-b': read('worker-b'),
    ack: async (r) => {
      const [oldest] = await r.xPendingRange(KEY, GROUP, '-', '+', 1);

      return oldest ? { acked: oldest.id, reply: await r.xAck(KEY, GROUP, oldest.id) } : 'nothing pending';
    },
    pending: (r) => attempt(() => r.xPending(KEY, GROUP)),
  },
};
