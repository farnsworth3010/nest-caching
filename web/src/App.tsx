import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import './App.i18n';
import { setLang } from './i18n';
import { CachePage } from './pages/cache/CachePage';
import { ClusterPage } from './pages/ClusterPage';
import { HealthPage } from './pages/HealthPage';
import { K8sPage } from './pages/K8sPage';
import { LockPage } from './pages/LockPage';
import { RateLimitPage } from './pages/RateLimitPage';
import { RealWorldPage } from './pages/real-world/RealWorldPage';
import { ReplicationPage } from './pages/ReplicationPage';
import { TypesPage } from './pages/types/TypesPage';

// One entry per topic page; the key is the URL hash.
const PAGES = {
  health: { Page: HealthPage },
  cache: { Page: CachePage },
  types: { Page: TypesPage },
  'rate-limit': { Page: RateLimitPage },
  lock: { Page: LockPage },
  replication: { Page: ReplicationPage },
  cluster: { Page: ClusterPage },
  k8s: { Page: K8sPage },
  'real-world': { Page: RealWorldPage },
};

type PageId = keyof typeof PAGES;

const subscribe = (onChange: () => void) => {
  addEventListener('hashchange', onChange);
  return () => removeEventListener('hashchange', onChange);
};

export function App() {
  const hash = useSyncExternalStore(subscribe, () => location.hash.slice(1));
  const current: PageId = hash in PAGES ? (hash as PageId) : 'health';
  const { Page } = PAGES[current];
  const { t, i18n } = useTranslation('app');

  return (
    <>
      <nav>
        <strong>{t('brand')}</strong>
        {(Object.keys(PAGES) as PageId[]).map((id) => (
          <a key={id} href={`#${id}`} aria-current={id === current ? 'page' : undefined}>
            {t(`nav.${id}`)}
          </a>
        ))}
        <button className="lang" onClick={() => setLang(i18n.language === 'ru' ? 'en' : 'ru')} aria-label={t('switchTo')}>
          {i18n.language === 'ru' ? 'EN' : 'RU'}
        </button>
      </nav>
      <main>
        <Page />
      </main>
    </>
  );
}
