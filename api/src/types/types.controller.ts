import { BadRequestException, Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { commandLog } from '../redis/command-log';
import { REDIS, type Redis } from '../redis/redis.module';
import { bitmap, hll } from './bits';
import { hash, list, set, string, zset } from './basic';
import type { Demo, Step } from './demo';
import { geo } from './geo';
import { json, probabilistic, timeseries, vector } from './redis8';
import { stream } from './stream';

const DEMOS: Record<string, Demo> = { string, hash, list, set, zset, stream, bitmap, hll, geo, json, timeseries, probabilistic, vector };

@Controller('types')
export class TypesController {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  @Get(':type')
  async state(@Param('type') type: string) {
    return { state: await this.demo(type).state(this.redis), stateFrom: 0 };
  }

  @Post(':type/:action')
  @HttpCode(200)
  async run(@Param('type') type: string, @Param('action') action: string) {
    const demo = this.demo(type);
    const step: Step | undefined = action === 'reset' ? (r) => r.unlink(demo.keys) : Object.hasOwn(demo.actions, action) ? demo.actions[action] : undefined;

    if (!step) throw new BadRequestException(`unknown action ${action} for ${type}`);

    const result = await step(this.redis);
    // Commands from here on only refresh the visualization; the UI shows them apart.
    const stateFrom = commandLog.getStore()?.length ?? 0;

    return { result, state: await demo.state(this.redis), stateFrom };
  }

  private demo(type: string) {
    if (!Object.hasOwn(DEMOS, type)) throw new BadRequestException(`unknown type ${type}`);

    return DEMOS[type];
  }
}
