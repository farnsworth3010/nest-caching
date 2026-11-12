import { Controller, Get, Inject } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { REDIS, type Redis } from './redis/redis.module';

@Controller('health')
export class HealthController {
  constructor(
    private readonly db: DatabaseSync,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get()
  async health() {
    const count = (table: string) => (this.db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;

    return {
      redis: await this.redis.ping(),
      products: count('products'),
      reviews: count('reviews'),
    };
  }
}
