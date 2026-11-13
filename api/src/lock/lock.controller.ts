import { Controller, HttpCode, Inject, Post, Query } from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';
import { trimLog } from '../redis/command-log';
import { REDIS, type Redis } from '../redis/redis.module';
import { acquire, release } from './lock';

const STOCK = 10;
const BUYERS = 30;
const LOCK_TTL_MS = 2000;
const LOCK_TIMEOUT_MS = 5000;
const MAX_COMMANDS = 40;

@Controller('lock/stock')
export class LockController {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  @Post('reset')
  @HttpCode(200)
  async reset() {
    await this.redis.set('demo:stock', STOCK);
    await this.redis.del('demo:sold');

    return { stock: STOCK };
  }

  // All buyers run in this one request; the awaits between GET and SET let them interleave like separate clients.
  @Post('buy')
  @HttpCode(200)
  async buy(@Query('lock') lock?: string) {
    const locked = lock === '1';
    const t0 = performance.now();
    const at = () => Math.round(performance.now() - t0);
    const initial = Number(await this.redis.get('demo:stock'));

    const timeline = await Promise.all(
      Array.from({ length: BUYERS }, async (_, buyer) => {
        const token = locked ? await acquire(this.redis, 'stock', LOCK_TTL_MS, LOCK_TIMEOUT_MS) : undefined;
        if (locked && !token) return { buyer, acquiredAt: at(), releasedAt: at(), result: 'timeout' };

        const acquiredAt = at();
        const stock = Number(await this.redis.get('demo:stock'));
        // Simulated work between the read and the write: the window the race needs.
        await sleep(5 + Math.random() * 15);

        if (stock > 0) {
          await this.redis.set('demo:stock', stock - 1);
          await this.redis.rPush('demo:sold', `buyer-${buyer}`);
        }

        if (token) await release(this.redis, 'stock', token);

        return { buyer, acquiredAt, releasedAt: at(), result: stock > 0 ? 'sold' : 'sold out' };
      }),
    );

    const sold = timeline.filter((t) => t.result === 'sold').length;
    const finalStock = Number(await this.redis.get('demo:stock'));

    return { locked, initial, sold, finalStock, oversold: sold > initial, timeline, commandCount: trimLog(MAX_COMMANDS) };
  }
}
