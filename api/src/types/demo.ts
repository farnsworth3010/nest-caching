import type { Redis } from '../redis/redis.module';

export type Step = (redis: Redis) => Promise<unknown>;

// One data type: the keys it owns, how to read its state, and the predefined scenario steps.
export type Demo = {
  keys: string[];
  state: Step;
  actions: Record<string, Step>;
};

// "Already exists" style errors are part of the lesson, so they become results instead of 500s.
export async function attempt(fn: () => Promise<unknown>) {
  try {
    return await fn();
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export const randomInt = (max: number) => Math.floor(Math.random() * max);

export const pick = <T>(list: T[]) => list[randomInt(list.length)];

export function chunk<T>(list: T[], size: number) {
  return Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));
}
