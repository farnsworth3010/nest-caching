import { BadRequestException, Controller, Get, HttpCode, Inject, OnModuleDestroy, OnModuleInit, Post, Query } from '@nestjs/common';
import { hostname } from 'node:os';
import { REDIS, type Redis } from '../redis/redis.module';

const HEARTBEAT_MS = 2_000;
const TTL_S = 5;
const MAX_BURN_MS = 500;

// In k8s the hostname is the pod name; in local dev it is the one dev process.
const POD = hostname();
const startedAt = Date.now();

// Pods find each other through Redis keys with a TTL: a pod that stops beating drops out after TTL_S.
@Controller('k8s')
export class K8sController implements OnModuleInit, OnModuleDestroy {
  private requests = 0;
  private timer?: NodeJS.Timeout;

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  onModuleInit() {
    this.timer = setInterval(() => this.beat().catch(() => {}), HEARTBEAT_MS);

    return this.beat();
  }

  // Runs on SIGTERM (enableShutdownHooks), before the Redis client closes: the pod leaves the list at once.
  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.redis.del([`k8s:pod:${POD}`, `k8s:requests:${POD}`]);
  }

  private beat() {
    return this.redis.set(`k8s:pod:${POD}`, JSON.stringify({ startedAt, requests: this.requests, at: Date.now() }), { EX: TTL_S });
  }

  private async count() {
    this.requests = await this.redis.incr(`k8s:requests:${POD}`);

    return this.requests;
  }

  @Get('pods')
  async pods() {
    const keys: string[] = [];

    for await (const batch of this.redis.scanIterator({ MATCH: 'k8s:pod:*', COUNT: 100 })) keys.push(...batch);

    const values = keys.length ? await this.redis.mGet(keys) : [];
    const pods = keys
      .map((key, i) => ({ name: key.slice('k8s:pod:'.length), ...(values[i] ? JSON.parse(values[i]) : {}) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { servedBy: POD, pods };
  }

  @Post('ping')
  @HttpCode(200)
  async ping() {
    return { servedBy: POD, requests: await this.count() };
  }

  // Busy-waits to load the CPU so the HPA has something to scale on; bounded so one request cannot hog a pod.
  @Post('burn')
  @HttpCode(200)
  async burn(@Query('ms') raw?: string) {
    const ms = Number(raw);

    if (!/^\d+$/.test(raw ?? '') || ms < 1 || ms > MAX_BURN_MS) throw new BadRequestException(`ms must be an integer 1..${MAX_BURN_MS}`);

    const end = performance.now() + ms;
    while (performance.now() < end);

    return { servedBy: POD, ms, requests: await this.count() };
  }
}
