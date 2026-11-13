import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Post, Res } from '@nestjs/common';
import { REDIS, type Redis } from '../redis/redis.module';

// express types are not installed; this is the part of its Response the handler uses.
type Response = { status(code: number): { setHeader(name: string, value: number): unknown } };

const LIMIT = 5;
const WINDOW_MS = 10_000;

// INCR and PEXPIRE in one script: a crash between two separate commands would leave a counter without a TTL.
export const RATE_LIMIT_SCRIPT = `local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return n`;

const window = () => {
  const now = Date.now();
  const start = now - (now % WINDOW_MS);

  return { start, resetInMs: start + WINDOW_MS - now };
};

@Controller('rate-limit')
export class RateLimitController {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  // Lets the page find the next window edge without spending a request.
  @Get()
  config() {
    return { limit: LIMIT, windowMs: WINDOW_MS, resetInMs: window().resetInMs, script: RATE_LIMIT_SCRIPT };
  }

  @Post('hit')
  @HttpCode(200)
  async hit(@Body() body: { client?: unknown }, @Res({ passthrough: true }) res: Response) {
    const client = body?.client;

    if (typeof client !== 'string' || !/^[\w-]{1,32}$/.test(client)) throw new BadRequestException('client must be 1..32 letters, digits, _ or -');

    const { start, resetInMs } = window();
    const count = Number(await this.redis.eval(RATE_LIMIT_SCRIPT, { keys: [`rl:${client}:${start}`], arguments: [String(WINDOW_MS)] }));
    const allowed = count <= LIMIT;

    if (!allowed) res.status(429).setHeader('Retry-After', Math.ceil(resetInMs / 1000));

    return { allowed, count, limit: LIMIT, windowMs: WINDOW_MS, resetInMs };
  }
}
