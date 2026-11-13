import { BadRequestException, ConflictException, Controller, Get, HttpCode, OnApplicationShutdown, Post, Query, ServiceUnavailableException } from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';
import { commandLog, trimLog } from '../redis/command-log';
import { closeAll, getCluster, HOST, moveSlot, node, onCluster, parseNodes, PORTS, query, SEED, slotsOf, SPARE, START_HINT, type ClusterNode } from './cluster';

const MAX_KEYS = 1000;
const MAX_SLOTS = 200;
const MAX_COMMANDS = 40;
const JOIN_TIMEOUT_MS = 10_000;
const RECREATE_HINT = 'recreate the cluster: docker compose -f deploy/compose.cluster.yaml down && docker compose -f deploy/compose.cluster.yaml up -d --wait';

// The masters `redis-cli --cluster create` picked for 3 masters; reset moves every slot back here.
const homeOf = (slot: number) => (slot <= 5460 ? 7000 : slot <= 10922 ? 7001 : 7002);

const mastersOf = (nodes: ClusterNode[]) => nodes.filter((n) => n.role === 'master' && !n.failing);

// Any member describes the whole cluster, so a dead or failed-over 7000 is skipped; a spare only knows itself.
// In-flight marks ("[93->-<id>]") appear only on a node's own line, so each master reports its own.
async function readNodes() {
  let nodes: ClusterNode[] = [];

  for (const port of PORTS) {
    nodes = await query(port, (c) => c.clusterNodes()).then(parseNodes, () => nodes);
    if (nodes.length > 1) break;
  }

  if (nodes.length === 0) throw new ServiceUnavailableException(`Redis Cluster is not reachable; ${START_HINT}`);

  await Promise.all(
    mastersOf(nodes).map(async (m) => {
      const self = await query(m.port, (c) => c.clusterNodes()).then((text) => parseNodes(text).find((n) => n.id === m.id), () => undefined);

      m.migrating = self?.migrating ?? [];
      m.importing = self?.importing ?? [];
    }),
  );

  return nodes;
}

const inFlight = (nodes: ClusterNode[]) => nodes.some((n) => n.migrating.length > 0 || n.importing.length > 0);

// The view's state: every node with its keys count, plus the spare nodes not joined yet.
async function readState() {
  const nodes = await readNodes();
  // A node that is down or silent but not yet flagged failed shows "?" keys instead of failing the whole view.
  const keys = await Promise.all(nodes.map((n) => (n.failing ? undefined : query(n.port, (c) => c.dbSize()).catch(() => undefined))));

  return {
    nodes: nodes.map((n, i) => ({ ...n, keys: keys[i] })),
    spare: SPARE.filter((port) => !nodes.some((n) => n.port === port)),
  };
}

// The action's commands come first (trimmed), then the ones that read the state; `split` tells the panel where.
async function withState<T extends object>(result: T) {
  const commandCount = trimLog(MAX_COMMANDS);
  const state = await readState();

  return { ...result, ...state, commandCount, split: Math.min(commandCount, MAX_COMMANDS) };
}

async function until(check: () => Promise<boolean>) {
  for (const start = Date.now(); !(await check()); await sleep(200)) {
    if (Date.now() - start > JOIN_TIMEOUT_MS) throw new ServiceUnavailableException('Timed out waiting for the cluster to agree');
  }
}

@Controller('cluster')
export class ClusterController implements OnApplicationShutdown {
  onApplicationShutdown() {
    return closeAll();
  }

  @Get()
  state() {
    return readState();
  }

  @Post('keys')
  @HttpCode(200)
  async keys(@Query('n') n?: string) {
    const count = Number(n);

    if (!Number.isInteger(count) || count < 1 || count > MAX_KEYS) throw new BadRequestException(`n must be an integer 1..${MAX_KEYS}`);

    const names = Array.from({ length: count }, (_, i) => `demo:c:${i}`);
    const slots = await onCluster(async (cluster) => {
      await Promise.all(names.map((key, i) => cluster.set(key, `value-${i}`)));

      return Promise.all(names.map((key) => cluster.clusterKeySlot(key)));
    });

    return withState({ keys: names.map((key, i) => ({ key, slot: slots[i] })) });
  }

  @Post('hashtag')
  @HttpCode(200)
  async hashtag() {
    const tagged = ['user:{42}:cart', 'user:{42}:profile', 'user:{42}:cart:backup'];
    const plain = ['user:42:cart', 'user:42:profile', 'user:42:cart:backup'];

    const result = await onCluster(async (cluster) => {
      const slots = await Promise.all([...tagged, ...plain].map((key) => cluster.clusterKeySlot(key)));
      // COPY is one command with two keys, so the server rejects it unless both hash to one slot.
      const copy = (from: string, to: string) => cluster.copy(from, to, { REPLACE: true }).then(String, (err: Error) => `(error) ${err.message}`);

      await cluster.mSet([[tagged[0], '3 items'], [tagged[1], 'Ada']]);
      const values = await cluster.mGet(tagged.slice(0, 2));
      const taggedCopy = await copy(tagged[0], tagged[2]);

      // node-redis splits a cross-slot MSET into one MSET per slot: it works, but is no longer atomic.
      await cluster.mSet([[plain[0], '3 items'], [plain[1], 'Ada']]);
      const plainCopy = await copy(plain[0], plain[2]);

      return { keys: [...tagged, ...plain].map((key, i) => ({ key, slot: slots[i] })), values, taggedCopy, plainCopy };
    });

    return withState(result);
  }

  @Post('add-node')
  @HttpCode(200)
  async addNode() {
    const nodes = await readNodes();

    if (nodes.some((n) => SPARE.includes(n.port))) throw new ConflictException('7006 and 7007 already joined; reset the cluster first');

    const seed = await node(SEED);
    const [master, replica] = await Promise.all(SPARE.map(node));

    await seed.clusterMeet(HOST, SPARE[0]);
    await seed.clusterMeet(HOST, SPARE[1]);
    const id = await master.clusterMyId();
    // CLUSTER REPLICATE fails until gossip has told 7007 about its new master, and a fresh master answers
    // CLUSTERDOWN (so MIGRATE to it fails) until it has learned the slot map.
    await until(async () => (await replica.clusterNodes()).includes(id) && (await master.clusterInfo()).includes('cluster_state:ok'));
    await replica.clusterReplicate(id);

    return withState({ joined: SPARE });
  }

  @Post('reshard')
  @HttpCode(200)
  async reshard(@Query('from') from?: string, @Query('to') to?: string, @Query('slots') slots?: string) {
    const count = Number(slots);

    if (!Number.isInteger(count) || count < 1 || count > MAX_SLOTS) throw new BadRequestException(`slots must be an integer 1..${MAX_SLOTS}`);

    const nodes = await readNodes();
    const masters = mastersOf(nodes);
    const src = masters.find((m) => String(m.port) === from);
    const dst = masters.find((m) => String(m.port) === to);

    if (!src || !dst || src === dst) throw new BadRequestException(`from and to must be two different masters: ${masters.map((m) => m.port).join(', ')}`);
    if (inFlight(nodes)) throw new ConflictException(`Some slots are still migrating; ${RECREATE_HINT}`);

    const plan = slotsOf(src).slice(0, count);

    if (plan.length === 0) throw new BadRequestException(`${src.port} owns no slots`);

    const cluster = await getCluster();
    const moved: string[] = [];
    let asked = false;

    for (const [i, slot] of plan.entries()) {
      // Not on the first slot: a target that owns no slot yet is unknown to the client's slot map, so it cannot follow -ASK there.
      const r = await moveSlot(slot, src, dst, masters, i > 0 && !asked ? cluster : undefined);

      moved.push(...r.moved);
      asked ||= r.asked;
    }

    // The client still maps the moved slots to the source: the first read gets -MOVED and refreshes the map.
    const checked = [];

    for (const key of moved.slice(-3)) checked.push({ key, value: await cluster.get(key) });

    // Each redirect with the two commands after it, shown apart because the log is trimmed long before them.
    const log = commandLog.getStore() ?? [];
    const near = new Set(log.flatMap((e, i) => (/^\(error\) (ASK|MOVED) /.test(String(e.reply)) ? [i, i + 1, i + 2] : [])));
    const redirects = log.filter((_, i) => near.has(i));

    return withState({ from: src.port, to: dst.port, slots: plan, keysMoved: moved.length, checked, redirects });
  }

  @Post('reset')
  @HttpCode(200)
  async reset() {
    const nodes = await readNodes();
    const masters = mastersOf(nodes);
    const home = new Map(masters.filter((m) => m.port <= 7002).map((m) => [m.port, m]));

    if (home.size < 3 || inFlight(nodes)) throw new ConflictException(`The cluster is not in a state reset can undo; ${RECREATE_HINT}`);

    let slots = 0;

    for (const m of masters) {
      for (const slot of slotsOf(m).filter((s) => homeOf(s) !== m.port)) {
        await moveSlot(slot, m, home.get(homeOf(slot))!, masters);
        slots++;
      }
    }

    // Replica first, so no node still follows 7006 when it is forgotten; every other node must FORGET within 60 s.
    const spare = SPARE.toReversed().flatMap((port) => nodes.filter((n) => n.port === port));

    for (const s of spare) {
      await (await node(s.port)).clusterReset({ mode: 'HARD' });

      for (const n of nodes.filter((n) => !SPARE.includes(n.port))) await (await node(n.port)).clusterForget(s.id);
    }

    return withState({ slotsMovedBack: slots, removed: spare.map((s) => s.port) });
  }
}
