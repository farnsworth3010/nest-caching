import { ServiceUnavailableException } from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';
import { ClientOfflineError, createClient, createCluster } from 'redis';
import { recordCommands } from '../redis/command-log';
import type { Redis } from '../redis/redis.module';

export const HOST = '127.0.0.1';
export const SEED = 7000;
export const PORTS = [7000, 7001, 7002, 7003, 7004, 7005, 7006, 7007];
export const SPARE = [7006, 7007];
export const START_HINT = 'start it with: docker compose -f deploy/compose.cluster.yaml up -d --wait';

const MIGRATE_BATCH = 100;
const MIGRATE_TIMEOUT_MS = 5000;
const READ_TIMEOUT_MS = 1000;
const CLUSTER_TIMEOUT_MS = 3000;

export type ClusterNode = {
  id: string;
  port: number;
  role: 'master' | 'replica';
  masterId?: string;
  failing: boolean;
  ranges: [number, number][];
  migrating: number[];
  importing: number[];
};

// Plain connections, one per node, for admin commands (CLUSTER SETSLOT, MIGRATE …) that must reach that exact node.
const direct = new Map<number, Promise<Redis>>();

export async function node(port: number) {
  const open = await direct.get(port)?.catch(() => undefined);
  if (open?.isOpen) return open;

  const client = createClient({ socket: { host: HOST, port, connectTimeout: 1000, reconnectStrategy: false } });
  // A down node fails the request that uses it; there is nothing else to report.
  client.on('error', () => {});
  recordCommands(client, `:${port}`);

  const ready = client.connect().catch(() => {
    throw new ServiceUnavailableException(`Redis node ${port} is not reachable; ${START_HINT}`);
  });
  direct.set(port, ready);

  return ready;
}

// A read on one node that gives up after a second. node-redis 6's commandOptions.timeout stops counting once the
// command is written, so a node that accepts TCP but never answers (paused, swapping) would hang the request.
export function query<T>(port: number, fn: (client: Redis) => Promise<T>) {
  const timeout = sleep(READ_TIMEOUT_MS).then(() => {
    throw new ServiceUnavailableException(`Redis node ${port} did not answer within ${READ_TIMEOUT_MS} ms`);
  });

  return Promise.race([node(port).then(fn), timeout]);
}

const create = () =>
  createCluster({
    rootNodes: [7000, 7001, 7002].map((port) => ({ socket: { host: HOST, port } })),
    // Fail fast instead of queueing commands for a node that is down.
    defaults: { disableOfflineQueue: true },
    // Connect to a master on first use: an eager connect waits on every master in the map, forever for a dead one.
    minimizeConnections: true,
  });
type Cluster = ReturnType<typeof create>;

let cluster: Promise<Cluster> | undefined;

// The routing client the app would use. Lazy, so the API still starts when the cluster is not running.
export function getCluster() {
  cluster ??= connectCluster().catch(() => {
    cluster = undefined;
    throw new ServiceUnavailableException(`Redis Cluster is not reachable; ${START_HINT}`);
  });

  return cluster;
}

// After a master dies, node-redis 6 keeps it in the slot map: commands for its slots throw ClientOfflineError or
// wait on its reconnect forever. Dropping the client lets the next request load the slot map from a live root node.
export async function onCluster<T>(fn: (client: Cluster) => Promise<T>) {
  const pending = getCluster();
  const timeout = sleep(CLUSTER_TIMEOUT_MS).then(() => {
    throw new ServiceUnavailableException(`Redis Cluster did not answer within ${CLUSTER_TIMEOUT_MS} ms`);
  });

  try {
    return await Promise.race([pending.then(fn), timeout]);
  } catch (err) {
    if (!(err instanceof ClientOfflineError || err instanceof ServiceUnavailableException)) throw err;

    // Another request may already have replaced it.
    if (cluster === pending) {
      cluster = undefined;
      pending.then((client) => client.destroy(), () => {});
    }

    throw new ServiceUnavailableException(`Lost a cluster node (${(err as Error).message}); the next request reconnects with a fresh slot map`);
  }
}

async function connectCluster() {
  const client = create();
  const hooked = new WeakSet<object>();
  const nodeClient = client._slots.nodeClient.bind(client._slots);

  client.on('error', (err: Error) => console.error('Redis cluster error', err.message));

  // Every command the cluster routes goes through a per-node client fetched here; hooking it labels the log with the node.
  client._slots.nodeClient = async (shard) => {
    const nodeRedis = await nodeClient(shard);

    if (!hooked.has(nodeRedis)) {
      hooked.add(nodeRedis);
      recordCommands(nodeRedis as unknown as Redis, `:${shard.port}`);
    }

    return nodeRedis;
  };

  try {
    return await client.connect();
  } catch (err) {
    client.destroy();
    throw err;
  }
}

export async function closeAll() {
  const clients = await Promise.allSettled([...direct.values(), ...(cluster ? [cluster] : [])]);

  await Promise.allSettled(clients.map((c) => (c.status === 'fulfilled' && c.value.isOpen ? c.value.close() : undefined)));
}

// `CLUSTER NODES` line: <id> <ip:port@bus> <flags> <master|-> <ping> <pong> <epoch> <link> <slot>…
// A slot entry is "0-5460", "5461", or an in-flight one: "[93->-<id>]" migrating, "[93-<-<id>]" importing.
export function parseNodes(text: string): ClusterNode[] {
  return text
    .trim()
    .split('\n')
    .map((line) => {
      const [id, addr, flags, masterId, , , , , ...slots] = line.trim().split(' ');
      const inFlight = (dir: string) => slots.flatMap((s) => (s.startsWith(`[`) && s.includes(`-${dir}-`) ? [parseInt(s.slice(1), 10)] : []));

      return {
        id,
        port: Number(addr.split('@')[0].split(':').at(-1)),
        role: flags.includes('master') ? ('master' as const) : ('replica' as const),
        masterId: masterId === '-' ? undefined : masterId,
        failing: /fail|handshake|noaddr/.test(flags),
        ranges: slots
          .filter((s) => !s.startsWith('['))
          .map((s) => {
            const [a, b = a] = s.split('-').map(Number);

            return [a, b] as [number, number];
          }),
        migrating: inFlight('>'),
        importing: inFlight('<'),
      };
    })
    .sort((a, b) => a.port - b.port);
}

export const slotsOf = (n: ClusterNode) => n.ranges.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i));

// The slot-migration protocol `redis-cli --cluster reshard` runs. With `ask`, the first key is moved alone and then
// read through the routing client: the source no longer has it while the slot is MIGRATING, so it answers -ASK.
export async function moveSlot(slot: number, from: ClusterNode, to: ClusterNode, masters: ClusterNode[], ask?: Cluster) {
  const src = await node(from.port);
  const dst = await node(to.port);
  const moved: string[] = [];
  let asked = false;

  await dst.clusterSetSlot(slot, 'IMPORTING', from.id);
  await src.clusterSetSlot(slot, 'MIGRATING', to.id);

  for (let keys; (keys = await src.clusterGetKeysInSlot(slot, MIGRATE_BATCH)).length > 0; ) {
    const batch = ask && !asked ? keys.slice(0, 1) : keys;

    await src.migrate(HOST, to.port, batch, 0, MIGRATE_TIMEOUT_MS);
    moved.push(...batch);

    if (ask && !asked) {
      await ask.get(batch[0]);
      asked = true;
    }
  }

  // Target first, then source, then the other masters, as redis-cli does, so the slot always has an owner.
  for (const m of [to, from, ...masters.filter((m) => m !== to && m !== from)]) {
    // A master that gave away its last slot turns into a replica, possibly before this reaches it; redis-cli ignores this too.
    await (await node(m.port)).clusterSetSlot(slot, 'NODE', to.id).catch((err: Error) => {
      if (m === to || !err.message.includes('only with masters')) throw err;
    });
  }

  return { moved, asked };
}
