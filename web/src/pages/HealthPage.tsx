import { useEffect, useState } from 'react';
import { api, type Command } from '../api';
import { CommandsPanel } from '../CommandsPanel';

type Health = { redis: string; products: number; reviews: number; commands: Command[] };

export function HealthPage() {
  const [health, setHealth] = useState<Health>();
  const [error, setError] = useState<string>();

  const load = () => {
    setError(undefined);
    api<Health>('/health').then(setHealth, (err: Error) => setError(err.message));
  };

  useEffect(load, []);

  return (
    <>
      <h1>Health</h1>
      <p>Checks that the API can reach Redis and the SQLite database.</p>
      <button onClick={load}>Refresh</button>
      {error && <p className="error">{error}</p>}
      {health && (
        <>
          <dl>
            <dt>Redis</dt>
            <dd>{health.redis}</dd>
            <dt>Products</dt>
            <dd>{health.products.toLocaleString()}</dd>
            <dt>Reviews</dt>
            <dd>{health.reviews.toLocaleString()}</dd>
          </dl>
          <CommandsPanel commands={health.commands} />
        </>
      )}
    </>
  );
}
