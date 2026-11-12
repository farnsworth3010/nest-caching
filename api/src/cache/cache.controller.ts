import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as sleep } from 'node:timers/promises';
import { REDIS, type Redis } from '../redis/redis.module';

const TTL_SECONDS = 60;
const MAX_DELAY_MS = 2000;
const key = (id: number) => `product:${id}`;

@Controller()
export class CacheController {
  constructor(
    private readonly db: DatabaseSync,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get('products/:id')
  async product(@Param('id', ParseIntPipe) id: number, @Query('delay', new DefaultValuePipe(0), ParseIntPipe) delay: number) {
    const start = performance.now();

    if (id < 1) throw new BadRequestException('id must be a positive integer');
    if (delay < 0 || delay > MAX_DELAY_MS) throw new BadRequestException(`delay must be an integer 0..${MAX_DELAY_MS}`);

    const cached = await this.redis.get(key(id));
    let product: unknown = cached && JSON.parse(cached);

    if (!product) {
      // Simulates network latency to a remote database.
      await sleep(delay);

      product = this.load(id);
      if (!product) throw new NotFoundException(`product ${id} not found`);

      await this.redis.set(key(id), JSON.stringify(product), { EX: TTL_SECONDS });
    }

    const ttl = await this.redis.ttl(key(id));

    return { product, source: cached ? 'cache' : 'db', serverMs: Math.round(performance.now() - start), ttl };
  }

  @Delete('cache/products/:id')
  async invalidate(@Param('id', ParseIntPipe) id: number) {
    return { deleted: await this.redis.unlink(key(id)) };
  }

  @Post('cache/flush')
  @HttpCode(200)
  async flush() {
    let deleted = 0;

    // SCAN + UNLINK touches only cache keys and never blocks Redis, unlike KEYS or FLUSHDB.
    for await (const keys of this.redis.scanIterator({ MATCH: 'product:*', COUNT: 500 })) {
      if (keys.length) deleted += await this.redis.unlink(keys);
    }

    return { deleted };
  }

  @Post('cache/flushdb')
  @HttpCode(200)
  async flushDb() {
    return { reply: await this.redis.flushDb('ASYNC') };
  }

  @Get('cache/stats')
  async stats() {
    let keys = 0;

    for await (const batch of this.redis.scanIterator({ MATCH: 'product:*', COUNT: 500 })) keys += batch.length;

    const info = await this.redis.info('stats');
    const stat = (name: string) => Number(info.match(new RegExp(`^${name}:(\\d+)`, 'm'))?.[1] ?? 0);

    return { keys, hits: stat('keyspace_hits'), misses: stat('keyspace_misses') };
  }

  // The slow path: no index on reviews.product_id, so the aggregate scans the whole table.
  private load(id: number) {
    const row = this.db.prepare('SELECT id, name, category, price, description FROM products WHERE id = ?').get(id);
    if (!row) return undefined;

    const ratings = this.db.prepare('SELECT rating, count(*) AS n FROM reviews WHERE product_id = ? GROUP BY rating').all(id) as { rating: number; n: number }[];
    const distribution = Object.fromEntries([1, 2, 3, 4, 5].map((r) => [r, ratings.find((x) => x.rating === r)?.n ?? 0]));
    const count = ratings.reduce((sum, x) => sum + x.n, 0);
    const avgRating = count ? Math.round((ratings.reduce((sum, x) => sum + x.rating * x.n, 0) / count) * 100) / 100 : null;

    return { ...row, reviews: { count, avgRating, distribution } };
  }
}
