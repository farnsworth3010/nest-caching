import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, type Command } from '../api';
import { CommandsPanel } from '../CommandsPanel';
import './HealthPage.i18n';

type Health = { redis: string; products: number; reviews: number; commands: Command[] };

export function HealthPage() {
  const [health, setHealth] = useState<Health>();
  const [error, setError] = useState<string>();
  const { t, i18n } = useTranslation('health');

  const load = () => {
    setError(undefined);
    api<Health>('/health').then(setHealth, (err: Error) => setError(err.message));
  };

  useEffect(load, []);

  return (
    <>
      <h1>{t('title')}</h1>
      <p>{t('intro')}</p>
      <button onClick={load}>{t('refresh')}</button>
      {error && <p className="error">{error}</p>}
      {health && (
        <>
          <dl>
            <dt>Redis</dt>
            <dd>{health.redis}</dd>
            <dt>{t('products')}</dt>
            <dd>{health.products.toLocaleString(i18n.language)}</dd>
            <dt>{t('reviews')}</dt>
            <dd>{health.reviews.toLocaleString(i18n.language)}</dd>
          </dl>
          <CommandsPanel commands={health.commands} />
        </>
      )}
    </>
  );
}
