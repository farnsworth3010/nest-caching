import { Trans, useTranslation } from 'react-i18next';
import type { TypeDemo, ViewProps } from './types';

type Entry = { id: string; message: Record<string, string>; status: 'new' | 'pending' | 'acked'; consumer: string | null };
type State = { group: { name: string; lastDelivered: string; pending: number } | null; entries: Entry[] };

function View({ state }: ViewProps<State>) {
  const { t } = useTranslation('types');

  if (!state.entries.length)
    return (
      <p>
        <Trans t={t} i18nKey="stream.empty" components={{ code: <code /> }} />
      </p>
    );

  return (
    <>
      <p className="hint">
        {state.group
          ? t('stream.group', { name: state.group.name, last: state.group.lastDelivered, pending: state.group.pending })
          : t('stream.noGroup')}
      </p>
      <table className="stream">
        <thead>
          <tr>
            <th>{t('stream.id')}</th>
            <th>{t('stream.fields')}</th>
            <th>{t('stream.status')}</th>
          </tr>
        </thead>
        <tbody>
          {state.entries.map((e) => (
            <tr key={e.id}>
              <td>
                <code>{e.id}</code>
              </td>
              <td>{Object.entries(e.message).map(([k, v]) => `${k}=${v}`).join(' ')}</td>
              <td>
                <span className={`badge ${e.status}`}>{t(`stream.statuses.${e.status}`, { consumer: e.consumer })}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export const stream: TypeDemo = {
  id: 'stream',
  group: 'Core',
  cheats: [
    'XADD key * f v …',
    'XRANGE key - +',
    'XLEN key',
    'XGROUP CREATE key g 0 MKSTREAM',
    'XREADGROUP GROUP g c COUNT n STREAMS key >',
    'XACK key g id',
    'XPENDING key g',
  ],
  View,
};
