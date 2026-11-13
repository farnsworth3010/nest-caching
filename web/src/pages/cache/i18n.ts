import { addNs, type Ru } from '../../i18n';

const en = {
  title: 'Cache-aside',
  ms: '{{v}} ms',
  s: '{{v}} s',
  intro: {
    how: 'With cache-aside the application owns the cache. On a read it first asks Redis; on a hit it returns the cached value, on a miss it queries the database, stores the result in Redis with a TTL and returns it.',
    ttl: 'The TTL bounds how stale a cached value can get. When data changes, the writer deletes (invalidates) the key, so the next read misses and loads fresh data.',
    stampede:
      'Beware of a cache stampede: when a hot key expires, many requests miss at once and all hit the database. A lock around the reload fixes it: try the Stampede section below, and see the <a>Lock page</a> for how the lock works.',
    delay:
      'The database here is local SQLite, so the real query is fast. The slider adds a delay to each miss to simulate a complex SQL query (heavy joins and aggregates over large tables).',
  },
  controls: {
    productId: 'Product id',
    random: 'Random',
    cost: 'SQL query cost: {{ms}} ms',
    requests: 'Requests',
    fetch: 'Fetch',
    runMany: 'Run {{count}} requests',
    invalidate: 'Invalidate this key',
    flush: 'Flush cache',
    flushHint:
      'Flush cache deletes only <code>product:*</code> keys with SCAN + UNLINK. FLUSHDB wipes every demo key, including other pages\' data.',
  },
  notes: {
    invalidated_one: 'Invalidated product:{{id}} ({{count}} key).',
    invalidated_other: 'Invalidated product:{{id}} ({{count}} keys).',
    flushed_one: 'Flushed {{count}} cache key.',
    flushed_other: 'Flushed {{count}} cache keys.',
    flushdb: 'FLUSHDB done: every key in the database is gone.',
    shown: 'Showing the first {{shown}} of {{total}} Redis commands.',
  },
  stampede: {
    title: 'Stampede',
    hint: 'Deletes <code>product:7</code>, then fires {{n}} concurrent reads of it server-side with the SQL query cost above. With the lock, only the request that wins <code>SET lock:product:7 … NX PX</code> loads from SQL; the others poll the cache key until it appears.',
    without: 'Stampede without lock',
    with: 'Stampede with lock',
    mode: 'Mode',
    dbLoads: 'DB loads',
    served: 'Requests served',
    total: 'Total time',
    withLock: 'with lock',
    withoutLock: 'without lock',
  },
  last: {
    title: 'Last response',
    hit: 'cache hit',
    miss: 'db (miss)',
    server: 'Server',
    client: 'Client',
    json: 'Product JSON',
    none: 'No request yet.',
  },
  flow: {
    aria: 'Cache-aside request flow',
    client: 'Client',
    db: 'SQL DB',
    request: 'request / reply',
    select: '2. SELECT (miss only)',
    hit: 'Last request: cache hit, served from Redis only.',
    miss: 'Last request: cache miss, read from SQL, then stored in Redis.',
    none: 'Fetch a product to see its path.',
  },
  chart: {
    title: 'Client round-trip latency',
    clear: 'Clear chart',
    hits: 'Hits',
    misses: 'Misses',
    request: 'Request #{{n}}',
    hit: 'Cache hit',
    miss: 'DB (miss)',
  },
};

const ru: Ru<typeof en> = {
  title: 'Cache-aside',
  ms: '{{v}} мс',
  s: '{{v}} с',
  intro: {
    how: 'В схеме cache-aside кешем управляет само приложение. При чтении оно сначала обращается к Redis: при кеш-хите возвращает значение из кеша, при промахе делает запрос в базу, кладёт результат в Redis с TTL и возвращает его.',
    ttl: 'TTL ограничивает, насколько устаревшим может быть значение в кеше. Когда данные меняются, тот, кто их записал, удаляет (инвалидирует) ключ, поэтому следующее чтение промахивается и загружает свежие данные.',
    stampede:
      'Опасайтесь лавины запросов (cache stampede): когда истекает горячий ключ, множество запросов одновременно промахиваются и все идут в базу. Это лечится блокировкой вокруг перезагрузки: попробуйте раздел «Лавина запросов» ниже, а как устроена сама блокировка, смотрите на <a>странице «Блокировка»</a>.',
    delay:
      'База здесь — локальный SQLite, поэтому настоящий запрос быстрый. Ползунок добавляет задержку к каждому промаху, имитируя сложный SQL-запрос (тяжёлые JOIN и агрегаты по большим таблицам).',
  },
  controls: {
    productId: 'Id товара',
    random: 'Случайный',
    cost: 'Стоимость SQL-запроса: {{ms}} мс',
    requests: 'Запросов',
    fetch: 'Запросить',
    runMany: 'Выполнить запросов: {{count}}',
    invalidate: 'Инвалидировать ключ',
    flush: 'Очистить кеш',
    flushHint:
      '«Очистить кеш» удаляет только ключи <code>product:*</code> через SCAN + UNLINK. FLUSHDB стирает все ключи демо, включая данные других страниц.',
  },
  notes: {
    invalidated_one: 'Ключ product:{{id}} инвалидирован (удалён {{count}} ключ).',
    invalidated_few: 'Ключ product:{{id}} инвалидирован (удалено {{count}} ключа).',
    invalidated_many: 'Ключ product:{{id}} инвалидирован (удалено {{count}} ключей).',
    invalidated_other: 'Ключ product:{{id}} инвалидирован (удалено {{count}} ключа).',
    flushed_one: 'Удалён {{count}} ключ кеша.',
    flushed_few: 'Удалено {{count}} ключа кеша.',
    flushed_many: 'Удалено {{count}} ключей кеша.',
    flushed_other: 'Удалено {{count}} ключа кеша.',
    flushdb: 'FLUSHDB выполнен: в базе не осталось ни одного ключа.',
    shown: 'Показаны первые {{shown}} из {{total}} команд Redis.',
  },
  stampede: {
    title: 'Лавина запросов',
    hint: 'Удаляет <code>product:7</code>, затем на сервере запускает {{n}} одновременных чтений этого товара со стоимостью SQL-запроса, заданной выше. С блокировкой из SQL загружает только запрос, выигравший <code>SET lock:product:7 … NX PX</code>; остальные опрашивают ключ кеша, пока он не появится.',
    without: 'Лавина без блокировки',
    with: 'Лавина с блокировкой',
    mode: 'Режим',
    dbLoads: 'Загрузок из БД',
    served: 'Обслужено запросов',
    total: 'Общее время',
    withLock: 'с блокировкой',
    withoutLock: 'без блокировки',
  },
  last: {
    title: 'Последний ответ',
    hit: 'кеш-хит',
    miss: 'БД (промах)',
    server: 'Сервер',
    client: 'Клиент',
    json: 'JSON товара',
    none: 'Запросов ещё не было.',
  },
  flow: {
    aria: 'Путь запроса в cache-aside',
    client: 'Клиент',
    db: 'БД SQL',
    request: 'запрос / ответ',
    select: '2. SELECT (промах)',
    hit: 'Последний запрос: кеш-хит, ответ только из Redis.',
    miss: 'Последний запрос: промах, чтение из SQL, затем запись в Redis.',
    none: 'Запросите товар, чтобы увидеть путь запроса.',
  },
  chart: {
    title: 'Задержка запроса со стороны клиента',
    clear: 'Очистить график',
    hits: 'Хиты',
    misses: 'Промахи',
    request: 'Запрос №{{n}}',
    hit: 'Кеш-хит',
    miss: 'БД (промах)',
  },
};

addNs('cache', en, ru);

declare module 'i18next' {
  interface ResourceNamespaceMap {
    cache: typeof en;
  }
}
