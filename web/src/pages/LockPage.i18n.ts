import { addNs, type Ru } from '../i18n';

const en = {
  title: 'Distributed lock',
  intro: {
    race: 'Read-modify-write races: 30 buyers each read the stock, do some work, then write stock − 1. Without coordination they all read the same value before anyone writes, so every one of them "sells" and the shop oversells. Running the API on several pods makes it worse, and an in-process mutex cannot help there; a lock in Redis can.',
    how: "Acquire: <code>SET lock:stock &lt;random token&gt; NX PX 2000</code> succeeds for one client only; the others retry with a short random backoff. Release: a Lua script deletes the key only if it still holds the caller's token, so a client whose lock already expired cannot delete a lock someone else now holds. The TTL is required: without it a crashed holder blocks everyone forever.",
    fencing:
      'The TTL also means a slow holder can lose the lock mid-work while another client takes it. Fencing tokens fix that: the lock hands out an increasing number and the storage rejects writes with an older one. Redlock (one lock across several independent Redis nodes) is debated because its safety depends on bounded clock drift and process pauses, which real systems do not guarantee.',
  },
  controls: {
    without: 'Buy without lock',
    with: 'Buy with lock',
    reset: 'Reset',
    hint: 'Each run resets <code>demo:stock</code> to 10, then 30 concurrent buyers try to buy one unit each, server-side in one request.',
  },
  notes: {
    reset: 'Stock reset to {{stock}}.',
    shown: 'Showing the first {{shown}} of {{total}} Redis commands.',
  },
  run: {
    with: 'With lock',
    without: 'Without lock',
    before: 'Stock before',
    sold: 'Sold',
    oversold: ' (oversold by {{n}})',
    after: 'Stock after',
    commands: 'Redis commands',
  },
  gantt: {
    with: 'Buyer timeline, with lock',
    without: 'Buyer timeline, without lock',
    ms: '{{v}} ms',
  },
  legend: {
    text: 'One row per buyer, sorted by start. Bar: from the stock read to the write (with lock: while holding it); grey line: waiting for the lock.',
    sold: 'sold',
    oversold: 'oversold',
    soldOut: 'sold out',
  },
};

const ru: Ru<typeof en> = {
  title: 'Распределённая блокировка',
  intro: {
    race: 'Гонка «прочитать — изменить — записать»: 30 покупателей читают остаток, что-то делают, затем записывают остаток − 1. Без координации все они читают одно и то же значение до того, как кто-либо успеет записать, поэтому каждый «продаёт» товар и магазин продаёт больше, чем есть. Если API запущен в нескольких подах, всё ещё хуже, и мьютекс внутри процесса тут не поможет, а блокировка в Redis — поможет.',
    how: 'Захват: <code>SET lock:stock &lt;random token&gt; NX PX 2000</code> срабатывает только у одного клиента; остальные повторяют попытку после короткой случайной паузы. Освобождение: Lua-скрипт удаляет ключ, только если в нём всё ещё лежит токен вызывающего, так что клиент, чья блокировка уже истекла, не может удалить блокировку, которую теперь держит кто-то другой. TTL обязателен: без него упавший владелец заблокирует всех навсегда.',
    fencing:
      'Из-за TTL медленный владелец может потерять блокировку посреди работы, пока её захватит другой клиент. Это решают fencing-токены: блокировка выдаёт возрастающий номер, а хранилище отклоняет записи с более старым номером. Redlock (одна блокировка на нескольких независимых узлах Redis) вызывает споры: его надёжность зависит от ограниченного расхождения часов и пауз процессов, а реальные системы этого не гарантируют.',
  },
  controls: {
    without: 'Купить без блокировки',
    with: 'Купить с блокировкой',
    reset: 'Сбросить',
    hint: 'Каждый прогон сбрасывает <code>demo:stock</code> до 10, затем 30 одновременных покупателей пытаются купить по одной единице — на сервере, в одном запросе.',
  },
  notes: {
    reset: 'Остаток сброшен до {{stock}}.',
    shown: 'Показаны первые {{shown}} из {{total}} команд Redis.',
  },
  run: {
    with: 'С блокировкой',
    without: 'Без блокировки',
    before: 'Остаток до',
    sold: 'Продано',
    oversold: ' (перепродано на {{n}})',
    after: 'Остаток после',
    commands: 'Команд Redis',
  },
  gantt: {
    with: 'Шкала времени покупателей, с блокировкой',
    without: 'Шкала времени покупателей, без блокировки',
    ms: '{{v}} мс',
  },
  legend: {
    text: 'Одна строка на покупателя, по времени начала. Полоса: от чтения остатка до записи (с блокировкой — пока она удерживается); серая линия: ожидание блокировки.',
    sold: 'продано',
    oversold: 'перепродано',
    soldOut: 'распродано',
  },
};

addNs('lock', en, ru);

declare module 'i18next' {
  interface ResourceNamespaceMap {
    lock: typeof en;
  }
}
