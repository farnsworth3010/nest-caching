import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { createClient, createSentinel } from 'redis';
import { recordCommands, recordSentinelCommands } from './command-log';

export const REDIS = Symbol('REDIS');

const create = () => createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' });
export type Redis = ReturnType<typeof create>;

// REDIS_SENTINELS="host:port,…" (Kubernetes): follow the master that Sentinel names, through failovers.
const createWithSentinel = (nodes: string) =>
  createSentinel({
    name: process.env.REDIS_MASTER_NAME ?? 'mymaster',
    sentinelRootNodes: nodes.split(',').map((node) => {
      const [host, port] = node.split(':');

      if (!host || !Number(port)) throw new Error(`REDIS_SENTINELS: expected host:port, got "${node}"`);

      return { host, port: Number(port) };
    }),
    // A command stuck on a demoted master otherwise waits out the 5 s default before the client looks for the new one.
    commandOptions: { timeout: 1000 },
  });

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: async () => {
        const sentinels = process.env.REDIS_SENTINELS;
        // shortcut: typed as a plain client; same typed commands, but sendCommand takes (readonly, args). Use a union type if a page needs it.
        const client = sentinels ? (createWithSentinel(sentinels) as unknown as Redis) : create();

        client.on('error', (err) => console.error('Redis error', err));

        // Entries are labeled with the node that ran them (redis-1), so a failover shows in the commands panel.
        if (sentinels) recordSentinelCommands(client, ({ host = '?', port }) => (/^[\d.:]+$/.test(host) ? `${host}:${port}` : host.split('.')[0]));
        else recordCommands(client);

        return client.connect();
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown() {
    await this.redis.close();
  }
}
