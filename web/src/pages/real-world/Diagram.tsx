type Kind = 'client' | 'app' | 'redis' | 'db' | 'llm' | 'worker';

// x, y are box centers; a label may hold several lines split by \n.
export type DiagramNode = { id: string; label: string; x: number; y: number; kind: Kind };
export type DiagramEdge = [from: string, to: string, label?: string, both?: boolean];
export type DiagramSpec = { nodes: DiagramNode[]; edges: DiagramEdge[]; caption: string };

const W = 150;
const H = 50;
const GAP = 4;

export function Diagram({ nodes, edges, caption }: DiagramSpec) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const width = Math.max(...nodes.map((n) => n.x)) + W / 2 + 10;
  const height = Math.max(...nodes.map((n) => n.y)) + H / 2 + 10;

  return (
    <figure className="flow rw-diagram">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={caption}>
        <defs>
          <marker id="rw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" />
          </marker>
        </defs>
        {edges.map(([from, to, label, both]) => {
          const a = byId[from];
          const b = byId[to];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          // Clip the center-to-center line at both box borders.
          const t = Math.min(dx ? (W / 2 + GAP) / Math.abs(dx) : Infinity, dy ? (H / 2 + GAP) / Math.abs(dy) : Infinity);
          const [x1, y1, x2, y2] = [a.x + dx * t, a.y + dy * t, b.x - dx * t, b.y - dy * t];

          return (
            <g key={`${from}-${to}`}>
              <line
                className="rw-edge"
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                markerEnd="url(#rw-arrow)"
                markerStart={both ? 'url(#rw-arrow)' : undefined}
              />
              {label && (
                // The middle of the visible segment, not of the centers, keeps the label off the boxes.
                <text className="rw-edge-label" x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle">
                  {label}
                </text>
              )}
            </g>
          );
        })}
        {nodes.map((n) => (
          <g key={n.id} className={`rw-node ${n.kind}`}>
            <rect x={n.x - W / 2} y={n.y - H / 2} width={W} height={H} rx={6} />
            <text x={n.x} y={n.y - ((n.label.split('\n').length - 1) * 8) + 5} textAnchor="middle">
              {n.label.split('\n').map((line, i) => (
                <tspan key={i} x={n.x} dy={i ? 16 : 0}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
