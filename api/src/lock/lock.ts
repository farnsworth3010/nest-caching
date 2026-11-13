import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Redis } from '../redis/redis.module';

// Deletes the lock only if it still holds our token, so an expired holder cannot free someone else's lock.
export const RELEASE_SCRIPT = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

// Returns the token on success, undefined when the timeout passes; timeoutMs 0 means a single try.
export async function acquire(redis: Redis, name: string, ttlMs: number, timeoutMs: number) {
  const token = randomUUID();
  const deadline = Date.now() + timeoutMs;

  while (true) {
    if (await redis.set(`lock:${name}`, token, { condition: 'NX', expiration: { type: 'PX', value: ttlMs } })) return token;
    if (Date.now() >= deadline) return undefined;

    // Random backoff so waiting buyers do not retry in lockstep.
    await sleep(5 + Math.random() * 10);
  }
}

export async function release(redis: Redis, name: string, token: string) {
  return (await redis.eval(RELEASE_SCRIPT, { keys: [`lock:${name}`], arguments: [token] })) === 1;
}
