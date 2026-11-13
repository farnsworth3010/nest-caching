import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  OnApplicationShutdown,
  ParseIntPipe,
  Post,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';
import { createClient, createSentinel } from 'redis';
import { recordCommands, recordSentinelCommands } from '../redis/command-log';
import type { Redis } from '../redis/redis.module';

// Matches deploy/compose.replication.yaml: the nodes announce these loopback addresses to Sentinel.
const HOST = '127.0.0.1';
const NODES = [6380, 6381, 6382];
const SENTINELS = [26380, 26381, 26382];
const MASTER_NAME = 'mymaster';
const KEY = 'demo:repl:counter';
const PROBE_TIMEOUT_MS = 1000;
const MAX_READS = 50;

const newSentinel = () =>
  createSentinel({
    name: MASTER_NAME,
    sentinelRootNodes: SENTINELS.map((port) => ({ host: HOST, port })),
    // A command stuck on the demoted master otherwise waits out the 5 s default before the client looks for the new one.
    commandOptions: { timeout: 1000 },
  }).on('error', () => {});

type Sentinel = ReturnType<typeof newSentinel>;

// A node that is down must fail fast instead of queueing commands until it returns.
const direct = (port: number) => {
  const client = createClient({ socket: { host: HOST, port, connectTimeout: 1000, reconnectStrategy: () => 1000 }, disableOfflineQueue: true }) as Redis;

  client.on('error', () => {});
  recordCommands(client, `:${port}`);
  client.connect().catch(() => {});

  return client;
};

// INFO replies are "key:value" lines; SENTINEL replies arrive as RESP3 maps, i.e. plain objects.
const parseInfo = (text: string) => Object.fromEntries(text.split('\r\n').filter((l) => l.includes(':')).map((l) => l.split(/:(.*)/s).slice(0, 2)));
type Fields = Record<string, string>;
const message = (err: unknown) => (err as Error).message;

// Bounds the wait for a reply: node-redis's commandOptions.timeout stops counting once the command is written,
// so a node that hangs with its socket open would otherwise stall the whole request.
const timeout = <T>(promise: Promise<T>) =>
  Promise.race([promise, sleep(PROBE_TIMEOUT_MS).then(() => Promise.reject(new Error(`no reply in ${PROBE_TIMEOUT_MS} ms`)))]);

@Controller('replication')
export class ReplicationController implements OnApplicationShutdown {
  private readonly nodes = new Map(NODES.map((port) => [port, direct(port)]));
  private readonly sentinels = new Map(SENTINELS.map((port) => [port, direct(port)]));
  private sentinel?: Promise<Sentinel>;
  // Kept apart from the promise: connect() never settles while no Sentinel is up, and shutdown must not wait on it.
  private client?: Sentinel;

  // Connected lazily, so the API still starts when the replication stack is not running.
  private master() {
    this.sentinel ??= (this.client = newSentinel())
      .connect()
      .then((sentinel) => recordSentinelCommands(sentinel, (socket) => `:${socket.port} via Sentinel`))
      .catch((err) => {
        this.client = this.sentinel = undefined;
        throw err;
      });

    return this.sentinel;
  }

  // connect() keeps retrying while no Sentinel is up, so requests must not wait on it unbounded.
  private connected() {
    return timeout(this.master()).catch((err) => {
      throw new ServiceUnavailableException(`Sentinel client not ready: ${message(err)}`);
    });
  }

  private async replicaPorts() {
    const master = (await this.connected()).getMasterNode();

    return NODES.filter((port) => port !== master?.port);
  }

  private async read(port: number) {
    try {
      return { node: port, value: await timeout(this.nodes.get(port)!.get(KEY)) };
    } catch (err) {
      return { node: port, error: message(err) };
    }
  }

  @Get()
  async topology() {
    const nodes = await Promise.all(
      NODES.map(async (port) => {
        try {
          const info = parseInfo(await timeout(this.nodes.get(port)!.info('replication')));
          const replicas = Object.keys(info)
            .filter((k) => /^slave\d+$/.test(k))
            .map((k) => Object.fromEntries(info[k].split(',').map((kv: string) => kv.split('='))))
            .map((r) => ({ port: Number(r.port), state: r.state, offset: Number(r.offset), lag: Number(r.lag) }));

          return {
            port,
            up: true,
            role: info.role,
            offset: Number(info.master_repl_offset),
            masterPort: info.master_port ? Number(info.master_port) : undefined,
            link: info.master_link_status,
            replicas,
          };
        } catch (err) {
          return { port, up: false, error: message(err) };
        }
      }),
    );

    const sentinels = await Promise.all(
      SENTINELS.map(async (port) => {
        try {
          const m = (await timeout(this.sentinels.get(port)!.sendCommand(['SENTINEL', 'MASTER', MASTER_NAME]))) as Fields;

          return { port, up: true, master: Number(m.port), flags: m.flags, quorum: Number(m.quorum), otherSentinels: Number(m['num-other-sentinels']), failover: m['failover-state'] };
        } catch (err) {
          return { port, up: false, error: message(err) };
        }
      }),
    );

    const first = sentinels.find((s) => s.up);
    const replicas = first
      ? ((await this.sentinels.get(first.port)!.sendCommand(['SENTINEL', 'REPLICAS', MASTER_NAME])) as Fields[]).map((r) => ({ port: Number(r.port), flags: r.flags }))
      : [];

    return { nodes, sentinels, sentinelReplicas: replicas };
  }

  // INCR on the master, then GET on each replica right away and again after WAIT.
  @Post('write')
  @HttpCode(200)
  async write() {
    const sentinel = await this.connected();
    const value = String(await sentinel.incr(KEY));
    const ports = await this.replicaPorts();
    const before = await Promise.all(ports.map((port) => this.read(port)));
    // WAIT counts replicas that acked every write sent so far on this connection; the Sentinel client keeps one master connection.
    const acked = await sentinel.sendCommand(false, ['WAIT', '2', '100']);
    const after = await Promise.all(ports.map((port) => this.read(port)));

    return { master: sentinel.getMasterNode()?.port, value, before, acked, after };
  }

  // Round-robin GETs over the replicas: reads scale out, and each one may be slightly stale.
  @Post('reads')
  @HttpCode(200)
  async reads(@Query('n', new DefaultValuePipe(10), ParseIntPipe) n: number) {
    if (n < 1 || n > MAX_READS) throw new BadRequestException(`n must be an integer 1..${MAX_READS}`);

    const ports = await this.replicaPorts();
    // Concurrent, so a hung replica costs one timeout, not one per read sent to it.
    const reads = await Promise.all(Array.from({ length: n }, (_, i) => this.read(ports[i % ports.length])));

    return { reads };
  }

  @Post('failover')
  @HttpCode(200)
  async failover() {
    for (const [port, client] of this.sentinels) {
      try {
        return { ok: true, sentinel: port, reply: await client.sendCommand(['SENTINEL', 'FAILOVER', MASTER_NAME]) };
      } catch (err) {
        // INPROG or NOGOODSLAVE come from a live Sentinel: report them instead of asking the next one.
        if (client.isReady) return { ok: false, sentinel: port, error: message(err) };
      }
    }

    return { ok: false, error: 'no Sentinel reachable' };
  }

  // One write through the Sentinel client; the page calls it twice a second to measure failover downtime.
  @Post('probe')
  @HttpCode(200)
  async probe() {
    const start = performance.now();
    const ms = () => Math.round(performance.now() - start);

    try {
      const sentinel = await timeout(this.master());

      await timeout(sentinel.incr('demo:repl:probe'));

      return { ok: true, master: sentinel.getMasterNode()?.port, ms: ms() };
    } catch (err) {
      return { ok: false, error: message(err), ms: ms() };
    }
  }

  onApplicationShutdown() {
    for (const client of [...this.nodes.values(), ...this.sentinels.values()]) client.destroy();

    this.client?.destroy();
  }
}
