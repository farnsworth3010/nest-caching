import type { Source } from './types';

const BOXES = [
  { label: 'Client', x: 10, y: 90 },
  { label: 'API', x: 260, y: 90 },
  { label: 'Redis', x: 570, y: 10 },
  { label: 'SQL DB', x: 570, y: 170 },
];

// Which edges the last request used: a hit never reaches SQL.
export function FlowDiagram({ source }: { source?: Source }) {
  const edge = (on: boolean) => (on ? `edge active ${source}` : 'edge');

  return (
    <figure className="flow">
      <svg viewBox="0 0 700 230" role="img" aria-label="Cache-aside request flow">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 10 5 0 10z" fill="context-stroke" />
          </marker>
        </defs>

        <line className={edge(!!source)} x1="130" y1="115" x2="260" y2="115" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
        <text x="195" y="100" textAnchor="middle">request / reply</text>

        <line className={edge(!!source)} x1="380" y1="105" x2="570" y2="40" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
        <text x="630" y="80" textAnchor="middle">1. GET · 3. SET EX 60</text>

        <line className={edge(source === 'db')} x1="380" y1="125" x2="570" y2="195" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
        <text x="630" y="158" textAnchor="middle">2. SELECT (miss only)</text>

        {BOXES.map((b) => (
          <g key={b.label}>
            <rect className={`box ${b.label === 'SQL DB' && source === 'cache' ? 'idle' : ''}`} x={b.x} y={b.y} width="120" height="50" rx="8" />
            <text x={b.x + 60} y={b.y + 30} textAnchor="middle" className="box-label">
              {b.label}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>
        {source === 'cache' && 'Last request: cache hit, served from Redis only.'}
        {source === 'db' && 'Last request: cache miss, read from SQL, then stored in Redis.'}
        {!source && 'Fetch a product to see its path.'}
      </figcaption>
    </figure>
  );
}
