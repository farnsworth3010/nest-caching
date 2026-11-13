import { addNs, type Ru } from '../i18n';

const en = {
  intro: {
    slots:
      'A cluster splits the keyspace into <strong>16384 hash slots</strong>: <code>slot = CRC16(key) mod 16384</code>. Each master owns some slot ranges and stores only their keys. The client caches the slot map (<code>CLUSTER SLOTS</code>) and sends every command straight to the owner, with no proxy hop.',
    hashtags:
      '<strong>Hash tags</strong>: when a key has <code>{…}</code>, only the part inside is hashed, so <code>user:{42}:cart</code> and <code>user:{42}:profile</code> share a slot. Commands with several keys (<code>MSET</code>, <code>COPY</code>, <code>SUNIONSTORE</code>, <code>MULTI</code>, Lua scripts) need all keys in one slot or fail with <code>CROSSSLOT</code>. node-redis quietly splits <code>MSET</code>/<code>MGET</code> per slot, which is no longer atomic. A popular tag puts all its traffic on one shard.',
    redirects:
      '<strong>MOVED vs ASK</strong>: <code>-MOVED slot host:port</code> means the slot now lives elsewhere for good: the client retries there and refreshes its slot map. <code>-ASK</code> means the slot is being migrated right now and this key has already left: the client asks the target once, prefixed with <code>ASKING</code>, and keeps its map.',
    failover:
      'Every master here has a replica. If a master stays unreachable longer than <code>cluster-node-timeout</code> (5 s here), the other masters mark it failed and its replica is promoted; replication is asynchronous, so the last acknowledged writes can be lost. <code>SCAN</code>, <code>KEYS</code>, <code>DBSIZE</code> and <code>FLUSHALL</code> only see one node: to walk all keys, run them on every master.',
    scaling:
      '<strong>Scaling out</strong>: <code>CLUSTER MEET</code> a new node, make another its replica with <code>CLUSTER REPLICATE</code>, then reshard: for each slot <code>SETSLOT IMPORTING</code> on the target, <code>MIGRATING</code> on the source, <code>GETKEYSINSLOT</code> + <code>MIGRATE</code> in batches, then <code>SETSLOT NODE</code> on every master. Keys stay readable throughout thanks to ASK. A master that gives away its last slot becomes a replica of the node that took it.',
  },
  controls: {
    keys: 'Keys',
    from: 'From',
    to: 'To',
    slots: 'Slots',
    write_one: 'Write {{count}} key',
    write_other: 'Write {{count}} keys',
    hashtag: 'Hash-tag demo',
    addNode: 'Add node 7006 + replica 7007',
    move_one: 'Move {{count}} slot {{src}} → {{dst}}',
    move_other: 'Move {{count}} slots {{src}} → {{dst}}',
    reset: 'Reset',
    refresh: 'Refresh',
    hint: 'Keys are <code>demo:c:0…</code>. Reset moves every slot back to 7000/7001/7002 and removes 7006/7007. If a reshard died midway, recreate the cluster: <code>docker compose -f deploy/compose.cluster.yaml down</code>, then <code>up -d --wait</code>.',
  },
  notes: {
    shown: 'Showing the first {{shown}} of {{total}} Redis commands of the action.',
    reset_one: 'Moved {{count}} slot back, removed {{removed}}.',
    reset_other: 'Moved {{count}} slots back, removed {{removed}}.',
    noNodes: 'no nodes',
  },
  map: {
    title: 'Slot map',
    aria: 'Hash slots 0 to 16383 colored by owning master',
    ticks: "Ticks above: the written keys' slots.",
    moved: 'last moved',
    inFlight: 'in flight',
  },
  node: {
    master: 'master',
    replica: 'replica',
    failing: ' (failing)',
    slots_one: '{{count}} slot',
    slots_other: '{{count}} slots',
    keys_one: '{{count}} key',
    keys_other: '{{count}} keys',
    keysUnknown: '? keys',
    spare: 'spare',
    notJoined: 'running, not joined',
  },
  landed_one: 'Where {{count}} key landed',
  landed_other: 'Where {{count}} keys landed',
  hashtag: {
    title: 'Hash tags',
    key: 'Key',
    slot: 'Slot',
    node: 'Node',
    mget: 'Tagged MGET',
    copy: 'Tagged COPY',
    plainCopy: 'Untagged COPY',
  },
  reshard: {
    title_one: 'Moved {{count}} slot ({{first}}–{{last}}) from :{{from}} to :{{to}}',
    title_other: 'Moved {{count}} slots ({{first}}–{{last}}) from :{{from}} to :{{to}}',
    checked: 'Values read back through the cluster client after the move:',
    missing: 'missing',
    redirects: 'Redirects caught in the log (real replies, not simulated):',
  },
};

const ru: Ru<typeof en> = {
  intro: {
    slots:
      'Кластер делит пространство ключей на <strong>16384 хеш-слота</strong>: <code>slot = CRC16(key) mod 16384</code>. Каждый мастер владеет несколькими диапазонами слотов и хранит только их ключи. Клиент кеширует карту слотов (<code>CLUSTER SLOTS</code>) и отправляет каждую команду сразу владельцу, без промежуточного прокси.',
    hashtags:
      '<strong>Хеш-теги</strong>: если в ключе есть <code>{…}</code>, хешируется только часть внутри скобок, поэтому <code>user:{42}:cart</code> и <code>user:{42}:profile</code> попадают в один слот. Командам с несколькими ключами (<code>MSET</code>, <code>COPY</code>, <code>SUNIONSTORE</code>, <code>MULTI</code>, Lua-скрипты) нужно, чтобы все ключи были в одном слоте, иначе они падают с <code>CROSSSLOT</code>. node-redis молча разбивает <code>MSET</code>/<code>MGET</code> по слотам, и такая операция уже не атомарна. Популярный тег отправляет весь свой трафик на один шард.',
    redirects:
      '<strong>MOVED и ASK</strong>: <code>-MOVED slot host:port</code> значит, что слот окончательно переехал: клиент повторяет команду там и обновляет карту слотов. <code>-ASK</code> значит, что слот переносится прямо сейчас и этот ключ уже ушёл: клиент один раз спрашивает целевой узел, предварив запрос командой <code>ASKING</code>, и карту не меняет.',
    failover:
      'У каждого мастера здесь есть реплика. Если мастер недоступен дольше <code>cluster-node-timeout</code> (здесь 5 с), остальные мастера помечают его как упавший и повышают его реплику до мастера; репликация асинхронная, поэтому последние подтверждённые записи могут потеряться. <code>SCAN</code>, <code>KEYS</code>, <code>DBSIZE</code> и <code>FLUSHALL</code> видят только один узел: чтобы обойти все ключи, выполните их на каждом мастере.',
    scaling:
      '<strong>Масштабирование</strong>: новый узел подключают через <code>CLUSTER MEET</code>, ещё один делают его репликой через <code>CLUSTER REPLICATE</code>, затем выполняют решардинг: для каждого слота <code>SETSLOT IMPORTING</code> на целевом узле, <code>MIGRATING</code> на исходном, <code>GETKEYSINSLOT</code> + <code>MIGRATE</code> пачками, затем <code>SETSLOT NODE</code> на каждом мастере. Благодаря ASK ключи всё это время остаются доступными для чтения. Мастер, отдавший последний слот, становится репликой узла, который его забрал.',
  },
  controls: {
    keys: 'Ключей',
    from: 'Откуда',
    to: 'Куда',
    slots: 'Слотов',
    write_one: 'Записать {{count}} ключ',
    write_few: 'Записать {{count}} ключа',
    write_many: 'Записать {{count}} ключей',
    write_other: 'Записать {{count}} ключа',
    hashtag: 'Демо хеш-тегов',
    addNode: 'Добавить узел 7006 + реплику 7007',
    move_one: 'Перенести {{count}} слот {{src}} → {{dst}}',
    move_few: 'Перенести {{count}} слота {{src}} → {{dst}}',
    move_many: 'Перенести {{count}} слотов {{src}} → {{dst}}',
    move_other: 'Перенести {{count}} слота {{src}} → {{dst}}',
    reset: 'Сбросить',
    refresh: 'Обновить',
    hint: 'Ключи называются <code>demo:c:0…</code>. «Сбросить» возвращает все слоты на 7000/7001/7002 и убирает 7006/7007. Если решардинг оборвался на середине, пересоздайте кластер: <code>docker compose -f deploy/compose.cluster.yaml down</code>, затем <code>up -d --wait</code>.',
  },
  notes: {
    shown: 'Показаны первые {{shown}} из {{total}} команд Redis этого действия.',
    reset_one: 'Возвращён {{count}} слот; удалённые узлы: {{removed}}.',
    reset_few: 'Возвращено {{count}} слота; удалённые узлы: {{removed}}.',
    reset_many: 'Возвращено {{count}} слотов; удалённые узлы: {{removed}}.',
    reset_other: 'Возвращено {{count}} слота; удалённые узлы: {{removed}}.',
    noNodes: 'нет',
  },
  map: {
    title: 'Карта слотов',
    aria: 'Хеш-слоты от 0 до 16383, раскрашенные по мастеру-владельцу',
    ticks: 'Риски сверху: слоты записанных ключей.',
    moved: 'перенесены последними',
    inFlight: 'переносятся',
  },
  node: {
    master: 'мастер',
    replica: 'реплика',
    failing: ' (недоступен)',
    slots_one: '{{count}} слот',
    slots_few: '{{count}} слота',
    slots_many: '{{count}} слотов',
    slots_other: '{{count}} слота',
    keys_one: '{{count}} ключ',
    keys_few: '{{count}} ключа',
    keys_many: '{{count}} ключей',
    keys_other: '{{count}} ключа',
    keysUnknown: '? ключей',
    spare: 'запасной',
    notJoined: 'запущен, не в кластере',
  },
  landed_one: 'Куда попал {{count}} ключ',
  landed_few: 'Куда попали {{count}} ключа',
  landed_many: 'Куда попали {{count}} ключей',
  landed_other: 'Куда попали {{count}} ключа',
  hashtag: {
    title: 'Хеш-теги',
    key: 'Ключ',
    slot: 'Слот',
    node: 'Узел',
    mget: 'MGET с хеш-тегом',
    copy: 'COPY с хеш-тегом',
    plainCopy: 'COPY без хеш-тега',
  },
  reshard: {
    title_one: 'Перенесён {{count}} слот ({{first}}–{{last}}) с :{{from}} на :{{to}}',
    title_few: 'Перенесено {{count}} слота ({{first}}–{{last}}) с :{{from}} на :{{to}}',
    title_many: 'Перенесено {{count}} слотов ({{first}}–{{last}}) с :{{from}} на :{{to}}',
    title_other: 'Перенесено {{count}} слота ({{first}}–{{last}}) с :{{from}} на :{{to}}',
    checked: 'Значения, прочитанные через клиент кластера после переноса:',
    missing: 'нет',
    redirects: 'Перенаправления из лога (настоящие ответы, не имитация):',
  },
};

addNs('cluster', en, ru);

declare module 'i18next' {
  interface ResourceNamespaceMap {
    cluster: typeof en;
  }
}
