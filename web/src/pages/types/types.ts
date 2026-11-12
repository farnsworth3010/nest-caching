import type { ComponentType, ReactNode } from 'react';

// Each View narrows the state shape its own endpoint returns.
export type ViewProps<S = any> = { state: S; result: unknown };

export type TypeDemo = {
  id: string;
  title: string;
  group: 'Core' | 'Redis 8';
  about: ReactNode;
  uses: string[];
  cheats: [command: string, what: string, complexity: string][];
  actions: [id: string, label: string][];
  View: ComponentType<ViewProps>;
};
