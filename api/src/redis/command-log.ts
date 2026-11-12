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

// Typed commands call sendCommand on the real client, which createClient hides behind an Object.create proxy.
// shortcut: MULTI/pipelines bypass sendCommand and are not recorded, wrap _executeMulti/_executePipeline when a phase needs them.
export function recordCommands(client: Redis) {
  const self = Object.getPrototypeOf(client) as Redis;
  const send = self.sendCommand;

  self.sendCommand = async function (this: Redis, ...params: Parameters<Redis['sendCommand']>) {
    const log = commandLog.getStore();
    if (!log) return send.apply(this, params);

    const [name, ...args] = params[0].map(String);
    const start = performance.now();
    const entry = (reply: unknown) => ({ cmd: name, args: clip(args), reply, ms: +(performance.now() - start).toFixed(3) });

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

@Injectable()
export class CommandsInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      map((body) => (body && typeof body === 'object' && !Array.isArray(body) ? { ...body, commands: commandLog.getStore() ?? [] } : body)),
    );
  }
}
