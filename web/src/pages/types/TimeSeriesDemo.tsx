import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TypeDemo, ViewProps } from './types';

type Sample = { timestamp: number; value: number };
type State = { raw: Sample[]; avg: Sample[] };

const time = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function View({ state }: ViewProps<State>) {
  if (!state.raw.length) return <p>No samples yet. Seed the series.</p>;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="timestamp" type="number" domain={['dataMin', 'dataMax']} tickFormatter={time} />
        <YAxis unit=" °C" domain={['auto', 'auto']} width={70} />
        <Tooltip labelFormatter={(ts) => time(Number(ts))} />
        <Legend />
        <Line data={state.raw} dataKey="value" name="Raw (1 min)" stroke="#8c959f" dot={false} isAnimationActive={false} />
        <Line data={state.avg} dataKey="value" name="AVG per 15 min" stroke="#0969da" strokeWidth={3} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export const timeseries: TypeDemo = {
  id: 'timeseries',
  title: 'TimeSeries',
  group: 'Redis 8',
  about:
    'A time series stores (timestamp, value) samples in compressed chunks. RETENTION drops old samples automatically, and TS.RANGE can aggregate on the server (avg, min, max, … per time bucket), so a chart of a day needs 96 points instead of 1 440.',
  uses: ['Metrics and sensor data', 'Downsampled charts (aggregation, compaction rules)', 'Rolling windows with automatic retention'],
  cheats: [
    ['TS.CREATE key RETENTION ms LABELS k v', 'Create a series with retention and labels', 'O(1)'],
    ['TS.ADD key * value', 'Add a sample now', 'O(M) chunks'],
    ['TS.MADD key ts value …', 'Add many samples in one command', 'O(N·M)'],
    ['TS.RANGE key - + AGGREGATION avg 900000', 'Read raw or aggregated samples', 'O(N/n + k)'],
  ],
  actions: [
    ['seed', 'TS.CREATE + TS.MADD 2 hours'],
    ['add', 'TS.ADD now'],
  ],
  View,
};
