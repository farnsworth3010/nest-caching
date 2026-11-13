import type { ComponentType } from 'react';

// Each View narrows the state shape its own endpoint returns.
export type ViewProps<S = any> = { state: S; result: unknown };

// Title, description, uses, cheat descriptions and action labels live in ./i18n.ts under the same id.
export type TypeDemo = {
  id: 'string' | 'hash' | 'list' | 'set' | 'zset' | 'stream' | 'bitmap' | 'hll' | 'geo' | 'json' | 'timeseries' | 'probabilistic' | 'vector';
  group: 'Core' | 'Redis 8';
  cheats: string[];
  View: ComponentType<ViewProps>;
};
