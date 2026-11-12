import type { Command } from '../../api';

export type Source = 'cache' | 'db';

export type ProductResponse = {
  product: Record<string, unknown>;
  source: Source;
  serverMs: number;
  ttl: number;
  commands: Command[];
};

export type Sample = { n: number; id: number; source: Source; ms: number };
