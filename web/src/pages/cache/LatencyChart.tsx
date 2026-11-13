import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Sample, Source } from './types';

// Nearest-rank percentile.
function percentile(sorted: number[], p: number) {
  return sorted.length ? sorted[Math.ceil((p / 100) * sorted.length) - 1] : undefined;
}

function Summary({ samples, source, label }: { samples: Sample[]; source: Source; label: string }) {
  const ms = samples.filter((s) => s.source === source).map((s) => s.ms).sort((a, b) => a - b);
  const { t } = useTranslation('cache');
  const fmt = (v?: number) => (v === undefined ? '–' : t('ms', { v }));

  return (
    <div className={`summary ${source}`}>
      <strong>
        {label}: {ms.length}
      </strong>
      <span>p50 {fmt(percentile(ms, 50))}</span>
      <span>p95 {fmt(percentile(ms, 95))}</span>
    </div>
  );
}

export function LatencyChart({ samples, onClear }: { samples: Sample[]; onClear: () => void }) {
  // One series per source so each bar gets its color and the legend comes for free.
  const data = samples.map((s) => ({ n: s.n, id: s.id, [s.source]: s.ms }));
  const { t } = useTranslation('cache');

  return (
    <section className="card">
      <div className="row">
        <h2>{t('chart.title')}</h2>
        <button onClick={onClear} disabled={!samples.length}>
          {t('chart.clear')}
        </button>
      </div>
      <div className="summaries">
        <Summary samples={samples} source="cache" label={t('chart.hits')} />
        <Summary samples={samples} source="db" label={t('chart.misses')} />
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="n" />
          <YAxis unit={t('ms', { v: '' })} width={70} />
          <Tooltip labelFormatter={(n) => t('chart.request', { n })} />
          <Legend />
          <Bar dataKey="cache" name={t('chart.hit')} stackId="ms" fill="#1a7f37" isAnimationActive={false} />
          <Bar dataKey="db" name={t('chart.miss')} stackId="ms" fill="#bc4c00" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
