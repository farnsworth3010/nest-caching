import { useTranslation } from 'react-i18next';
import type { TypeDemo, ViewProps } from './types';

type State = { views: string | null; flag: string | null; flagTtl: number; greeting: string | null; a: string | null; b: string | null };

function View({ state }: ViewProps<State>) {
  const { t } = useTranslation('types');
  const rows: [string, string | null, string?][] = [
    ['demo:string:views', state.views],
    ['demo:string:flag', state.flag, state.flagTtl > 0 ? t('string.expires', { s: state.flagTtl }) : undefined],
    ['demo:string:greeting', state.greeting],
    ['demo:string:a', state.a],
    ['demo:string:b', state.b],
  ];

  return (
    <table className="kv">
      <tbody>
        {rows.map(([key, value, note]) => (
          <tr key={key}>
            <td>
              <code>{key}</code>
            </td>
            <td>{value ?? <em>(nil)</em>}</td>
            <td className="hint">{note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const string: TypeDemo = {
  id: 'string',
  group: 'Core',
  cheats: [
    'SET key value [EX s] [NX|XX]',
    'GET key',
    'INCR / INCRBY key n',
    'APPEND key value',
    'GETDEL key',
    'MSET / MGET k1 v1 k2 …',
  ],
  View,
};
