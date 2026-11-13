import { BadRequestException } from '@nestjs/common';

export function check(ok: boolean, message: string): asserts ok {
  if (!ok) throw new BadRequestException(message);
}

export function text(value: unknown, name: string, max = 200) {
  check(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `${name} must be a non-empty string of at most ${max} chars`);

  return value.trim();
}

export function id(value: unknown, name: string) {
  check(typeof value === 'string' && /^[\w-]{1,32}$/.test(value), `${name} must be 1..32 letters, digits, _ or -`);

  return value;
}

export function oneOf<T extends string>(value: unknown, name: string, allowed: readonly T[]) {
  check(allowed.includes(value as T), `${name} must be one of ${allowed.join(', ')}`);

  return value as T;
}

export function int(value: unknown, name: string, min: number, max: number) {
  check(Number.isInteger(value) && (value as number) >= min && (value as number) <= max, `${name} must be an integer from ${min} to ${max}`);

  return value as number;
}
