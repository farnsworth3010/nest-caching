import { addNs, type Ru } from '../i18n';

const en = {
  title: 'Rate limiter',
  intro: {
    how: 'A fixed window limiter counts requests per client in windows of a fixed length. Each request runs <code>INCR rl:{client}:{windowStart}</code>; the first request of a window also sets a TTL, so old counters clean themselves up. Above the limit the API answers <code>429 Too Many Requests</code> with a <code>Retry-After</code> header. Here the limit is {{limit}} requests per {{s}} s.',
    edge: 'It is one key and one command per request, but it has an edge problem: a client can spend its whole limit just before a window ends and again just after the next one starts, so up to 2× the limit passes in a short burst. "Send at window edge" shows it.',
    other:
      'Not built here: a sliding log (a sorted set of timestamps per client, exact but stores every request) and a token bucket (a refill rate plus a burst size, smooth but needs a script to update state atomically).',
  },
  script: {
    title: 'The script',
    hint: '<code>INCR</code> and <code>PEXPIRE</code> run as one Lua script (<code>EVAL</code> in the commands panel): as two separate commands, a crash between them would leave a counter without a TTL that blocks the client forever.',
  },
  controls: {
    client: 'Client id',
    send: 'Send 1',
    burst: 'Burst 20',
    edge: 'Send at window edge',
    clear: 'Clear chart',
  },
  notes: {
    burst: '{{allowed}} of 20 allowed.',
    waiting: 'Waiting {{s}} s for the window edge…',
    edge: '{{allowed}} requests allowed within about 1 s across the edge, with a limit of {{limit}} per window.',
  },
  counter: 'Counter: {{current}} / {{limit}}',
  resets: 'resets in {{s}} s',
  chart: {
    aria: 'Requests over time: counter value per request, window edges as vertical lines',
    limit: 'limit {{limit}}',
    ago: '−{{s}} s',
    now: 'now',
    caption: 'Each dot is a request at the counter value it got: green allowed, red 429. Vertical lines are window edges.',
  },
};

const ru: Ru<typeof en> = {
  title: 'Лимит запросов',
  intro: {
    how: 'Лимитер с фиксированным окном считает запросы каждого клиента в окнах фиксированной длины. Каждый запрос выполняет <code>INCR rl:{client}:{windowStart}</code>; первый запрос в окне ещё и ставит TTL, так что старые счётчики удаляются сами. При превышении лимита API отвечает <code>429 Too Many Requests</code> с заголовком <code>Retry-After</code>. Здесь лимит — {{limit}} запросов за {{s}} с.',
    edge: 'Это один ключ и одна команда на запрос, но есть проблема на границе окна: клиент может израсходовать весь лимит перед самым концом окна и ещё раз сразу после начала следующего, так что за короткий всплеск проходит до 2× лимита. Это показывает кнопка «Отправить на границе окна».',
    other:
      'Здесь не реализованы: скользящий журнал (sorted set с отметками времени на клиента — точно, но хранит каждый запрос) и token bucket (скорость пополнения плюс размер всплеска — плавно, но для атомарного обновления состояния нужен скрипт).',
  },
  script: {
    title: 'Скрипт',
    hint: '<code>INCR</code> и <code>PEXPIRE</code> выполняются одним Lua-скриптом (<code>EVAL</code> в панели команд): если бы это были две отдельные команды, падение между ними оставило бы счётчик без TTL, и клиент был бы заблокирован навсегда.',
  },
  controls: {
    client: 'Id клиента',
    send: 'Отправить 1',
    burst: 'Всплеск из 20',
    edge: 'Отправить на границе окна',
    clear: 'Очистить график',
  },
  notes: {
    burst: 'Пропущено {{allowed}} из 20.',
    waiting: 'Ждём {{s}} с до границы окна…',
    edge: 'Пропущено запросов примерно за 1 с вокруг границы: {{allowed}}, при лимите {{limit}} на окно.',
  },
  counter: 'Счётчик: {{current}} / {{limit}}',
  resets: 'сброс через {{s}} с',
  chart: {
    aria: 'Запросы во времени: значение счётчика для каждого запроса, границы окон — вертикальные линии',
    limit: 'лимит {{limit}}',
    ago: '−{{s}} с',
    now: 'сейчас',
    caption: 'Каждая точка — запрос со значением счётчика, которое он получил: зелёная — пропущен, красная — 429. Вертикальные линии — границы окон.',
  },
};

addNs('rateLimit', en, ru);

declare module 'i18next' {
  interface ResourceNamespaceMap {
    rateLimit: typeof en;
  }
}
