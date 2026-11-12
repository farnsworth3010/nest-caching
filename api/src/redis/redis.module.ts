import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { createClient } from 'redis';
import { recordCommands } from './command-log';

export const REDIS = Symbol('REDIS');

const create = () => createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' });
export type Redis = ReturnType<typeof create>;

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: async () => {
        const client = create();

        client.on('error', (err) => console.error('Redis error', err));
        recordCommands(client);

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
