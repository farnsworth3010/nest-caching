import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createClient } from 'redis';
import { acquire, release } from '../src/lock/lock.ts';

const redis = await createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' }).connect();
after(() => redis.close());

test('only one holder at a time, and only the holder can release', async () => {
  await redis.del('lock:test');

  const token = await acquire(redis, 'test', 1000, 0);
  assert.ok(token);
  assert.equal(await acquire(redis, 'test', 1000, 50), undefined);

  assert.equal(await release(redis, 'test', 'someone-else'), false);
  assert.equal(await release(redis, 'test', token), true);
  assert.ok(await acquire(redis, 'test', 1000, 0));
});

test('an expired lock can be taken again', async () => {
  await redis.del('lock:test');
  await acquire(redis, 'test', 50, 0);

  assert.ok(await acquire(redis, 'test', 1000, 500));
  await redis.del('lock:test');
});
