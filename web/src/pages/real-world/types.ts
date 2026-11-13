import type { ComponentType } from 'react';
import type { DiagramNode } from './Diagram';

// Resolves to the body (with `status`) for 2xx, 409 and 429; to undefined on other errors, which the page shows.
// `keep` appends this call's commands to the panel instead of starting over (several sequential calls in one demo).
export type Post = <T>(path: string, body: object, keep?: boolean) => Promise<(T & { status: number }) | undefined>;

export type CaseDemoProps = { post: Post; busy: boolean };

export type CaseId = 'session' | 'leaderboard' | 'feed' | 'queue' | 'presence' | 'idempotency' | 'semantic-cache' | 'chat-memory' | 'token-budget' | 'rag';

// Title, texts, node and edge labels, command descriptions and demo labels live in ./i18n.ts under the same id.
export type Case = {
  id: CaseId;
  group: 'Architectures' | 'Redis + LLM';
  diagram: { nodes: Omit<DiagramNode, 'label'>[]; edges: [from: string, to: string, both?: boolean][] };
  uses: string[];
  Demo: ComponentType<CaseDemoProps>;
};
