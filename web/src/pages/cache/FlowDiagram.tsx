import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('cache');

  return (
    <figure className="flow">
      <svg viewBox="0 0 700 230" role="img" aria-label={t('flow.aria')}>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 10 5 0 10z" fill="context-stroke" />
          </marker>
        </defs>

        <line className={edge(!!source)} x1="130" y1="115" x2="260" y2="115" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
        <text x="195" y="100" textAnchor="middle">
          {t('flow.request')}
        </text>

        <line className={edge(!!source)} x1="380" y1="105" x2="570" y2="40" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
        <text x="630" y="80" textAnchor="middle">1. GET · 3. SET EX 60</text>

        <line className={edge(source === 'db')} x1="380" y1="125" x2="570" y2="195" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
        <text x="630" y="158" textAnchor="middle">
          {t('flow.select')}
        </text>

        {BOXES.map((b) => (
          <g key={b.label}>
            <rect className={`box ${b.label === 'SQL DB' && source === 'cache' ? 'idle' : ''}`} x={b.x} y={b.y} width="120" height="50" rx="8" />
            <text x={b.x + 60} y={b.y + 30} textAnchor="middle" className="box-label">
              {b.label === 'Client' ? t('flow.client') : b.label === 'SQL DB' ? t('flow.db') : b.label}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>
        {source === 'cache' && t('flow.hit')}
        {source === 'db' && t('flow.miss')}
        {!source && t('flow.none')}
      </figcaption>
    </figure>
  );
}
