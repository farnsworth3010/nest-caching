import { useSyncExternalStore } from 'react';
import { HealthPage } from './pages/HealthPage';

// One entry per topic page; the key is the URL hash.
const PAGES = {
  health: { title: 'Health', Page: HealthPage },
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

  return (
    <>
      <nav>
        <strong>Redis demo</strong>
        {Object.entries(PAGES).map(([id, { title }]) => (
          <a key={id} href={`#${id}`} aria-current={id === current ? 'page' : undefined}>
            {title}
          </a>
        ))}
      </nav>
      <main>
        <Page />
      </main>
    </>
  );
}
