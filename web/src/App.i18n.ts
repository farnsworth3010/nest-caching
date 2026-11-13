import { addNs, type Ru } from './i18n';

const en = {
  brand: 'Redis demo',
  switchTo: 'Switch to Russian',
  nav: {
    health: 'Health',
    cache: 'Cache-aside',
    types: 'Data types',
    'rate-limit': 'Rate limiter',
    lock: 'Lock',
    replication: 'Replication',
    cluster: 'Cluster',
    k8s: 'Kubernetes',
    'real-world': 'Real world',
  },
};

const ru: Ru<typeof en> = {
  brand: 'Демо Redis',
  switchTo: 'Переключить на английский',
  nav: {
    health: 'Состояние',
    cache: 'Cache-aside',
    types: 'Типы данных',
    'rate-limit': 'Лимит запросов',
    lock: 'Блокировка',
    replication: 'Репликация',
    cluster: 'Кластер',
    k8s: 'Kubernetes',
    'real-world': 'На практике',
  },
};

addNs('app', en, ru);

declare module 'i18next' {
  interface ResourceNamespaceMap {
    app: typeof en;
  }
}
