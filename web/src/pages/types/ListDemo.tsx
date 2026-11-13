import { useTranslation } from 'react-i18next';
import type { TypeDemo, ViewProps } from './types';

type State = { events: string[]; queue: string[]; processing: string[] };

function Row({ name, items }: { name: string; items: string[] }) {
  const { t } = useTranslation('types');

  return (
    <div className="list-row">
      <code>{name}</code>
      <div className="boxes">
        <span className="end">{t('list.head')}</span>
        {items.length ? items.map((item, i) => <span key={i} className="box">{item}</span>) : <em>{t('list.empty')}</em>}
        <span className="end">{t('list.tail')}</span>
      </div>
    </div>
  );
}

function View({ state }: ViewProps<State>) {
  const { t } = useTranslation('types');

  return (
    <>
      <Row name={`demo:list:events ${t('list.newest')}`} items={state.events} />
      <Row name="demo:list:queue" items={state.queue} />
      <Row name="demo:list:processing" items={state.processing} />
    </>
  );
}

export const list: TypeDemo = {
  id: 'list',
  group: 'Core',
  cheats: [
    'LPUSH / RPUSH key v',
    'LPOP / RPOP key',
    'LRANGE key start stop',
    'LTRIM key start stop',
    'LMOVE src dst LEFT RIGHT',
  ],
  View,
};
