import { addNs, type Ru } from './i18n';

const en = {
  title: 'Redis commands',
  none: 'No Redis commands in this request.',
  refresh: 'Then read the state for the view',
  more_one: '… {{count}} more command',
  more_other: '… {{count}} more commands',
};

const ru: Ru<typeof en> = {
  title: 'Команды Redis',
  none: 'В этом запросе не было команд Redis.',
  refresh: 'Затем чтение состояния для отображения',
  more_one: '… и ещё {{count}} команда',
  more_few: '… и ещё {{count}} команды',
  more_many: '… и ещё {{count}} команд',
  more_other: '… и ещё {{count}} команды',
};

addNs('commands', en, ru);

declare module 'i18next' {
  interface ResourceNamespaceMap {
    commands: typeof en;
  }
}
