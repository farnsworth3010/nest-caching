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
import { acquire, release } from '../lock/lock';
import { trimLog } from '../redis/command-log';
import { REDIS, type Redis } from '../redis/redis.module';

const TTL_SECONDS = 60;
const MAX_DELAY_MS = 2000;
const LOCK_TTL_MS = 3000;
const POLL_MS = 25;
const MAX_STAMPEDE = 200;
const MAX_COMMANDS = 40;
const STAMPEDE_ID = 7;
const key = (id: number) => `product:${id}`;

@Controller()
export class CacheController {
  private dbLoads = 0;

  constructor(
    private readonly db: DatabaseSync,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get('products/:id')
  async product(
    @Param('id', ParseIntPipe) id: number,
    @Query('delay', new DefaultValuePipe(0), ParseIntPipe) delay: number,
    @Query('lock', new DefaultValuePipe(0), ParseIntPipe) lock: number,
  ) {
    if (id < 1) throw new BadRequestException('id must be a positive integer');
    if (delay < 0 || delay > MAX_DELAY_MS) throw new BadRequestException(`delay must be an integer 0..${MAX_DELAY_MS}`);

    return this.read(id, delay, lock === 1);
  }

  // Flushes one product and fires n concurrent reads at it, like a hot key expiring under load.
  @Post('cache/stampede')
  @HttpCode(200)
  async stampede(
    @Query('lock', new DefaultValuePipe(0), ParseIntPipe) lock: number,
    @Query('n', new DefaultValuePipe(50), ParseIntPipe) n: number,
    @Query('delay', new DefaultValuePipe(200), ParseIntPipe) delay: number,
  ) {
    if (n < 1 || n > MAX_STAMPEDE) throw new BadRequestException(`n must be an integer 1..${MAX_STAMPEDE}`);
    if (delay < 0 || delay > MAX_DELAY_MS) throw new BadRequestException(`delay must be an integer 0..${MAX_DELAY_MS}`);

    await this.redis.unlink(key(STAMPEDE_ID));

    const loadsBefore = this.dbLoads;
    const start = performance.now();
    const results = await Promise.all(Array.from({ length: n }, () => this.read(STAMPEDE_ID, delay, lock === 1)));

    return {
      dbLoads: this.dbLoads - loadsBefore,
      served: results.length,
      totalMs: Math.round(performance.now() - start),
      commandCount: trimLog(MAX_COMMANDS),
    };
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

  // With lock, only the miss that wins lock:product:{id} loads from SQL; the others poll the cache key.
  private async read(id: number, delay: number, lock: boolean) {
    const start = performance.now();
    const cached = await this.redis.get(key(id));
    let product: unknown = cached && JSON.parse(cached);
    let source: 'cache' | 'db' = cached ? 'cache' : 'db';

    if (!product) {
      const token = lock ? await acquire(this.redis, key(id), LOCK_TTL_MS, 0) : undefined;

      if (lock && !token) {
        product = await this.waitForCache(id, delay + LOCK_TTL_MS);
        source = 'cache';
      }

      // No lock, the lock winner, or a loser that gave up waiting.
      if (!product) {
        product = await this.loadAndCache(id, delay).finally(() => token && release(this.redis, key(id), token));
        source = 'db';
      }
    }

    const ttl = await this.redis.ttl(key(id));

    return { product, source, serverMs: Math.round(performance.now() - start), ttl };
  }

  private async loadAndCache(id: number, delay: number) {
    // Simulates a complex SQL query.
    await sleep(delay);

    const product = this.load(id);
    if (!product) throw new NotFoundException(`product ${id} not found`);

    await this.redis.set(key(id), JSON.stringify(product), { EX: TTL_SECONDS });

    return product;
  }

  private async waitForCache(id: number, timeoutMs: number) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      await sleep(POLL_MS);

      const cached = await this.redis.get(key(id));
      if (cached) return JSON.parse(cached) as unknown;
    }

    return undefined;
  }

  // The slow path: no index on reviews.product_id, so the aggregate scans the whole table.
  private load(id: number) {
    this.dbLoads++;

    const row = this.db.prepare('SELECT id, name, category, price, description FROM products WHERE id = ?').get(id);
    if (!row) return undefined;

    const ratings = this.db.prepare('SELECT rating, count(*) AS n FROM reviews WHERE product_id = ? GROUP BY rating').all(id) as { rating: number; n: number }[];
    const distribution = Object.fromEntries([1, 2, 3, 4, 5].map((r) => [r, ratings.find((x) => x.rating === r)?.n ?? 0]));
    const count = ratings.reduce((sum, x) => sum + x.n, 0);
    const avgRating = count ? Math.round((ratings.reduce((sum, x) => sum + x.rating * x.n, 0) / count) * 100) / 100 : null;

    return { ...row, reviews: { count, avgRating, distribution } };
  }
}
