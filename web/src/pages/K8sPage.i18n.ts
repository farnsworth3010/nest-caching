import { addNs, type Ru } from '../i18n';

const en = {
  title: 'Kubernetes',
  intro: {
    stateless:
      'The api runs as a Deployment of identical pods behind a Service; the Service spreads new connections over the pods that are ready. That only works if pods are <strong>stateless</strong>: anything that must be the same for every request (cache, rate limit counters, locks, sessions) lives in Redis, not in the process. An in-process cache would be cold on every new pod and stale on the others; an in-process lock only stops requests that land on the same pod, so with 3 replicas three buyers can hold "the" lock at once.',
    shutdown:
      'Pods come and go. On scale-down or a rollout Kubernetes sends <code>SIGTERM</code>; the app has <code>enableShutdownHooks</code>, so Nest stops taking connections, finishes requests and closes Redis. A <code>preStop</code> sleep of 5 s lets the Service drop the pod from its endpoints first, and the grace period caps the whole thing before <code>SIGKILL</code>. A <strong>readiness</strong> probe on <code>/api/health</code> keeps a pod out of the Service until it has seeded SQLite and reaches Redis; a liveness probe restarts a hung one.',
    hpa: 'The <strong>HorizontalPodAutoscaler</strong> reads pod CPU from metrics-server every ~15 s and sets replicas to keep average usage near 50% of the CPU <em>request</em> (2 to 5 pods). It scales up quickly and down only after a stabilization window.',
    statefulSet:
      'Redis itself is stateful, so it runs as a <strong>StatefulSet</strong>: pods get stable names (<code>redis-0</code>, <code>redis-1</code>) and DNS entries through a headless Service, and each keeps its own PersistentVolumeClaim across restarts. Which pod is master, failover and rejoining are still up to Redis (Sentinel here); operators exist to encode that day-2 knowledge (failover, resharding, upgrades, backups) as a controller.',
    heartbeat:
      'Pods find each other without the Kubernetes API: each writes a heartbeat <code>SET k8s:pod:{name} … EX 5</code> every 2 s and the list below is <code>SCAN k8s:pod:*</code>. A crashed pod disappears within 5 s, a pod shut down by <code>SIGTERM</code> deletes its key at once. Outside Kubernetes the only "pod" is the dev process.',
  },
  pods: {
    title: 'Live pods: {{n}}',
    servedBy: 'this page is served by {{pod}}',
    up: 'up {{age}}',
    requests_one: '{{count}} request',
    requests_other: '{{count}} requests',
    share: '{{n}} of {{total}}',
    lastRun: '{{n}} of the last run',
  },
  age: {
    s: '{{v}} s',
    min: '{{v}} min',
  },
  controls: {
    ping: 'Ping ×{{n}}',
    stop: 'Stop load ({{s}} s)',
    load: 'Generate CPU load ({{s}} s)',
    hint: 'Ping sends parallel requests and counts which pod answered each. The Service balances connections, not requests, and the browser reuses a few keep-alive connections, so some pods may get none; for the same reason pods the HPA adds get no load from this page (an L7 proxy or Ingress would balance per request). CPU load runs {{workers}} parallel loops of <code>POST /api/k8s/burn?ms={{ms}}</code> (a bounded busy-wait on the server) for {{s}} s; watch the pod count grow below, or in a terminal:',
  },
  notes: {
    pinged_one: '{{n}} requests answered by {{count}} pod.',
    pinged_other: '{{n}} requests answered by {{count}} pods.',
    loadDone: 'Load finished. The HPA scales down after its stabilization window.',
    loadDoneErrors: 'Load finished with {{n}} failed requests. The HPA scales down after its stabilization window.',
  },
  chart: {
    label: 'Number of live pods over the last 5 minutes',
    min: 'min {{n}}',
    max: 'max {{n}}',
    start: '−5 min',
    now: 'now',
    caption: 'Live pods over the last 5 minutes, from the heartbeats (HPA bounds 2 to 5).',
  },
  failover: {
    title: 'Redis failover',
    text: "Redis runs as a StatefulSet of 3 pods with Sentinel as a sidecar in each: <code>redis-0</code> starts as master, the others replicate it. An init container asks the other pods' Sentinels who the master is, so a restarted pod rejoins as a replica of the current master instead of claiming the role back. The api connects through Sentinel (<code>REDIS_SENTINELS</code>), and each command in the panel is labeled with the node that ran it.",
    hint: 'Start the probe, then delete the master pod. Sentinel notices it is down after 3 s, the two left agree and promote a replica; the api client follows the new master. Pings fail only during that gap.',
    probe: 'Probe Redis ({{s}} s)',
    results: 'Probe results, oldest first',
    ok: '{{time}} {{node}} {{ms}} ms',
    failed: '{{time}} failed',
    probing: 'Probing for {{s}} s: delete the master pod now.',
    summary: '{{failed}} of {{total}} probes failed, from {{s}} s of downtime. Masters seen: {{masters}}.',
    clean: 'No failed probes. Masters seen: {{masters}}.',
    none: 'none',
  },
  shared: {
    title: 'State shared across pods',
    text: 'The <rate>rate limiter</rate> and the <lock>lock</lock> pages keep their state in Redis, so they give the same answers whichever pod serves each request: 20 requests spread over 5 pods still see one counter, and 30 buyers on different pods still get exactly 10 units. Run them here with several pods up.',
  },
};

const ru: Ru<typeof en> = {
  title: 'Kubernetes',
  intro: {
    stateless:
      'api работает как Deployment из одинаковых подов за Service; Service распределяет новые соединения по готовым подам. Это работает, только если поды <strong>без состояния</strong> (stateless): всё, что должно быть одинаковым для любого запроса (кеш, счётчики лимита запросов, блокировки, сессии), хранится в Redis, а не в процессе. Кеш внутри процесса был бы холодным на каждом новом поде и устаревшим на остальных, а блокировка внутри процесса останавливает только запросы, попавшие на тот же под, так что при 3 репликах «ту самую» блокировку могут одновременно держать три покупателя.',
    shutdown:
      'Поды появляются и исчезают. При уменьшении числа реплик или выкатке Kubernetes посылает <code>SIGTERM</code>; в приложении включён <code>enableShutdownHooks</code>, поэтому Nest перестаёт принимать соединения, дорабатывает запросы и закрывает Redis. Пауза <code>preStop</code> на 5 с даёт Service сначала убрать под из своих endpoints, а срок ожидания (grace period) ограничивает всё это по времени, после чего приходит <code>SIGKILL</code>. <strong>Readiness</strong>-проба на <code>/api/health</code> не пускает под в Service, пока он не заполнил SQLite и не достучался до Redis; liveness-проба перезапускает зависший под.',
    hpa: '<strong>HorizontalPodAutoscaler</strong> раз в ~15 с берёт загрузку CPU подов из metrics-server и подбирает число реплик так, чтобы средняя загрузка держалась около 50% от <em>request</em> по CPU (от 2 до 5 подов). Вверх он масштабирует быстро, а вниз — только после окна стабилизации.',
    statefulSet:
      'Сам Redis хранит состояние, поэтому работает как <strong>StatefulSet</strong>: у подов постоянные имена (<code>redis-0</code>, <code>redis-1</code>) и DNS-записи через headless Service, и каждый сохраняет свой PersistentVolumeClaim между перезапусками. Кто из подов мастер, failover (переключение на реплику) и возвращение в строй по-прежнему решает сам Redis (здесь — Sentinel); операторы нужны, чтобы оформить эти знания об эксплуатации (failover, решардинг, обновления, резервные копии) в виде контроллера.',
    heartbeat:
      'Поды находят друг друга без Kubernetes API: каждый раз в 2 с пишет heartbeat <code>SET k8s:pod:{name} … EX 5</code>, а список ниже — это <code>SCAN k8s:pod:*</code>. Упавший под пропадает из списка за 5 с, а под, остановленный через <code>SIGTERM</code>, сразу удаляет свой ключ. Вне Kubernetes единственный «под» — это dev-процесс.',
  },
  pods: {
    title: 'Работающие поды: {{n}}',
    servedBy: 'эту страницу обслуживает {{pod}}',
    up: 'работает {{age}}',
    requests_one: '{{count}} запрос',
    requests_few: '{{count}} запроса',
    requests_many: '{{count}} запросов',
    requests_other: '{{count}} запроса',
    share: '{{n}} из {{total}}',
    lastRun: '{{n}} за последний прогон',
  },
  age: {
    s: '{{v}} с',
    min: '{{v}} мин',
  },
  controls: {
    ping: 'Пинг ×{{n}}',
    stop: 'Остановить нагрузку ({{s}} с)',
    load: 'Нагрузить CPU ({{s}} с)',
    hint: 'Пинг отправляет параллельные запросы и считает, какой под ответил на каждый. Service балансирует соединения, а не запросы, а браузер переиспользует несколько keep-alive-соединений, поэтому некоторым подам может не достаться ни одного; по той же причине поды, добавленные HPA, не получают нагрузки с этой страницы (L7-прокси или Ingress балансировали бы каждый запрос). Нагрузка на CPU — это {{workers}} параллельных циклов <code>POST /api/k8s/burn?ms={{ms}}</code> (ограниченное по времени активное ожидание на сервере) в течение {{s}} с; смотрите, как растёт число подов ниже или в терминале:',
  },
  notes: {
    pinged_one: 'На {{n}} запросов ответил {{count}} под.',
    pinged_few: 'На {{n}} запросов ответили {{count}} пода.',
    pinged_many: 'На {{n}} запросов ответили {{count}} подов.',
    pinged_other: 'На {{n}} запросов ответили {{count}} пода.',
    loadDone: 'Нагрузка завершена. HPA уменьшит число подов после окна стабилизации.',
    loadDoneErrors: 'Нагрузка завершена, неудачных запросов: {{n}}. HPA уменьшит число подов после окна стабилизации.',
  },
  chart: {
    label: 'Число работающих подов за последние 5 минут',
    min: 'мин. {{n}}',
    max: 'макс. {{n}}',
    start: '−5 мин',
    now: 'сейчас',
    caption: 'Работающие поды за последние 5 минут по heartbeat-ключам (границы HPA — от 2 до 5).',
  },
  failover: {
    title: 'Failover в Redis',
    text: 'Redis работает как StatefulSet из 3 подов, в каждом рядом работает Sentinel (sidecar): <code>redis-0</code> стартует мастером, остальные его реплицируют. Init-контейнер спрашивает у Sentinel в других подах, кто сейчас мастер, поэтому перезапущенный под возвращается репликой текущего мастера, а не забирает роль обратно. api подключается через Sentinel (<code>REDIS_SENTINELS</code>), и каждая команда в панели помечена узлом, который её выполнил.',
    hint: 'Запустите проверку, затем удалите под мастера. Через 3 с Sentinel замечает, что он недоступен, два оставшихся договариваются и повышают реплику до мастера; клиент в api переходит на новый мастер. Пинги падают только в этом промежутке.',
    probe: 'Проверить Redis ({{s}} с)',
    results: 'Результаты проверок, от старых к новым',
    ok: '{{time}} {{node}} {{ms}} мс',
    failed: '{{time}} ошибка',
    probing: 'Проверка идёт {{s}} с: удалите под мастера сейчас.',
    summary: 'Неудачных проверок: {{failed}} из {{total}}, простой {{s}} с. Мастер: {{masters}}.',
    clean: 'Неудачных проверок нет. Мастер: {{masters}}.',
    none: 'неизвестен',
  },
  shared: {
    title: 'Общее состояние для всех подов',
    text: 'Страницы <rate>«Лимит запросов»</rate> и <lock>«Блокировка»</lock> хранят состояние в Redis, поэтому отвечают одинаково, какой бы под ни обслуживал запрос: 20 запросов на 5 подах видят один счётчик, а 30 покупателей на разных подах получают ровно 10 единиц товара. Запустите их здесь при нескольких подах.',
  },
};

addNs('k8s', en, ru);

declare module 'i18next' {
  interface ResourceNamespaceMap {
    k8s: typeof en;
  }
}
