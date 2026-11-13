import { useTranslation } from 'react-i18next';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TypeDemo, ViewProps } from './types';

type Sample = { timestamp: number; value: number };
type State = { raw: Sample[]; avg: Sample[] };

function View({ state }: ViewProps<State>) {
  const { t, i18n } = useTranslation('types');
  const time = (ts: number) => new Date(ts).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });

  if (!state.raw.length) return <p>{t('timeseries.empty')}</p>;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="timestamp" type="number" domain={['dataMin', 'dataMax']} tickFormatter={time} />
        <YAxis unit=" °C" domain={['auto', 'auto']} width={70} />
        <Tooltip labelFormatter={(ts) => time(Number(ts))} />
        <Legend />
        <Line data={state.raw} dataKey="value" name={t('timeseries.raw')} stroke="#8c959f" dot={false} isAnimationActive={false} />
        <Line data={state.avg} dataKey="value" name={t('timeseries.avg')} stroke="#0969da" strokeWidth={3} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export const timeseries: TypeDemo = {
  id: 'timeseries',
  group: 'Redis 8',
  cheats: [
    'TS.CREATE key RETENTION ms LABELS k v',
    'TS.ADD key * value',
    'TS.MADD key ts value …',
    'TS.RANGE key - + AGGREGATION avg 900000',
  ],
  View,
};
