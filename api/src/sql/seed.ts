import type { DatabaseSync } from 'node:sqlite';

const PRODUCTS = 5_000;
const REVIEWS = 300_000;
const CATEGORIES = ['books', 'games', 'garden', 'kitchen', 'music', 'sports', 'tools', 'toys'];
const WORDS = ['fast', 'solid', 'cheap', 'quiet', 'bright', 'heavy', 'smart', 'tiny', 'classic', 'pro'];

// mulberry32: seeded PRNG so every machine gets the same data.
function prng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Creates the schema and fills it when empty; returns true if it seeded.
export function seed(db: DatabaseSync): boolean {
  // No index on reviews.product_id: phase 1 needs a slow uncached query.
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      description TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY,
      product_id INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  if ((db.prepare('SELECT count(*) AS n FROM products').get() as { n: number }).n > 0) return false;

  const rand = prng(42);
  const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)];
  const insertProduct = db.prepare('INSERT INTO products (id, name, category, price, description) VALUES (?, ?, ?, ?, ?)');
  const insertReview = db.prepare('INSERT INTO reviews (product_id, rating, body, created_at) VALUES (?, ?, ?, ?)');
  const since = Date.UTC(2024, 0, 1);

  db.exec('BEGIN');

  try {
    for (let id = 1; id <= PRODUCTS; id++) {
      const category = pick(CATEGORIES);

      insertProduct.run(id, `${pick(WORDS)} ${category} item #${id}`, category, Math.round(rand() * 50_000) / 100, `A ${pick(WORDS)} and ${pick(WORDS)} product.`);
    }

    for (let i = 0; i < REVIEWS; i++) {
      const createdAt = new Date(since + Math.floor(rand() * 700 * 86_400_000)).toISOString();

      insertReview.run(1 + Math.floor(rand() * PRODUCTS), 1 + Math.floor(rand() * 5), `${pick(WORDS)}, ${pick(WORDS)} and ${pick(WORDS)}.`, createdAt);
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return true;
}
