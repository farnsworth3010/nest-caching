import { AsyncLocalStorage } from 'node:async_hooks';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs';
import type { Redis } from './redis.module';

export type CommandEntry = { cmd: string; args: string[]; reply: unknown; ms: number };

const MAX_ARGS = 20;

// Bulk commands (PFADD with 1 000 ids) would bloat every response, so long arg lists are cut.
const clip = (args: string[]) => (args.length > MAX_ARGS ? [...args.slice(0, MAX_ARGS), `… +${args.length - MAX_ARGS} more`] : args);

// One array per HTTP request; filled by recordCommands, returned by CommandsInterceptor.
export const commandLog = new AsyncLocalStorage<CommandEntry[]>();

// Keeps the first `max` commands of the request (a lock demo runs thousands) and returns the full count.
export function trimLog(max: number) {
  const log = commandLog.getStore() ?? [];
  const total = log.length;

  log.length = Math.min(total, max);

  return total;
}

// Typed commands call sendCommand on the real client, which createClient hides behind an Object.create proxy.
// `node` (e.g. ":6381") prefixes the command name when a page talks to several Redis servers.
export function recordCommands(client: Redis, node?: string) {
  const self = Object.getPrototypeOf(client) as Redis;
  const send = self.sendCommand;

  recordBatches(self, node);

  self.sendCommand = async function (this: Redis, ...params: Parameters<Redis['sendCommand']>) {
    const log = commandLog.getStore();
    if (!log) return send.apply(this, params);

    const [name, ...args] = params[0].map(String);
    const start = performance.now();
    const entry = (reply: unknown) => ({ cmd: node ? `[${node}] ${name}` : name, args: clip(args), reply, ms: +(performance.now() - start).toFixed(3) });

    try {
      const reply = await send.apply(this, params);

      log.push(entry(reply));

      return reply;
    } catch (err) {
      log.push(entry(`(error) ${(err as Error).message}`));
      throw err;
    }
  } as Redis['sendCommand'];
}

type Batch = { args: unknown[] }[];
type BatchMethod = (this: unknown, commands: Batch, ...rest: unknown[]) => Promise<unknown[]>;

// MULTI and pipelines skip sendCommand and go straight to the queue (node-redis 6 internals), so they are wrapped here:
// one entry per queued command with its own reply, timed as the whole batch.
function recordBatches(self: Redis, node?: string) {
  const methods = self as unknown as Record<'_executeMulti' | '_executePipeline', BatchMethod>;
  const label = (name: string) => (node ? `[${node}] ${name}` : name);

  for (const [method, multi] of [['_executeMulti', true], ['_executePipeline', false]] as const) {
    const execute = methods[method];

    methods[method] = async function (commands, ...rest) {
      const log = commandLog.getStore();
      if (!log) return execute.call(this, commands, ...rest);

      const start = performance.now();
      const push = (name: string, args: string[], reply: unknown) => log.push({ cmd: label(name), args: clip(args), reply, ms: +(performance.now() - start).toFixed(3) });
      const each = (replies: unknown[]) =>
        commands.forEach(({ args }, i) => {
          const [name, ...cmdArgs] = args.map(String);

          push(multi ? name : `${name} (pipeline)`, cmdArgs, replies[i]);
        });

      if (multi) push('MULTI', [], 'OK');

      try {
        const replies = await execute.call(this, commands, ...rest);

        each(replies);
        if (multi) push('EXEC', [], `${replies.length} replies`);

        return replies;
      } catch (err) {
        push(multi ? 'EXEC' : `pipeline of ${commands.length}`, [], `(error) ${(err as Error).message}`);
        throw err;
      }
    };
  }
}

type NodeSocket = { host?: string; port?: number };
type SentinelLike = { _execute: (readonly: boolean | undefined, fn: (client: Redis) => unknown) => Promise<unknown> };

// A Sentinel client runs typed commands through _execute on whichever node client it picked (node-redis 6 internals),
// so that is the narrowest place to attach recordCommands to each node client it creates; `node` labels the entries.
export function recordSentinelCommands<T extends object>(sentinel: T, node: (socket: NodeSocket) => string) {
  const self = Object.getPrototypeOf(sentinel) as SentinelLike;
  const execute = self._execute;
  const seen = new WeakSet<object>();

  self._execute = function (this: SentinelLike, readonly, fn) {
    return execute.call(this, readonly, (client) => {
      if (!seen.has(Object.getPrototypeOf(client))) {
        seen.add(Object.getPrototypeOf(client));
        recordCommands(client, node((client.options?.socket ?? {}) as NodeSocket));
      }

      return fn(client);
    });
  };

  return sentinel;
}

@Injectable()
export class CommandsInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      map((body) => (body && typeof body === 'object' && !Array.isArray(body) ? { ...body, commands: commandLog.getStore() ?? [] } : body)),
    );
  }
}
