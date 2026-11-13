import { addNs, type Ru } from '../i18n';

const en = {
  title: 'Replication and Sentinel',
  s: '{{v}} s',
  intro: {
    async:
      'Replication is asynchronous: the master answers the client first and streams each write to its replicas afterwards. Every node tracks a replication offset (bytes of that stream applied); a replica whose offset is behind the master\'s lags, and a read from it can return stale data. On this machine the replicas usually catch up before the next command, so stale reads are rare here; across a network they are not.',
    wait: '<code>WAIT numreplicas timeout</code> blocks until that many replicas acknowledged the client\'s writes. It makes a write semi-synchronous, not durable: an acked replica can still lose it on restart, and a failover can still pick a replica that missed it. Replicas also scale reads: spread GETs over them and accept slightly stale answers.',
    sentinel:
      'Sentinels watch the master. One that gets no reply for <code>down-after-milliseconds</code> marks it subjectively down (<code>s_down</code>); when a quorum agrees it becomes objectively down (<code>o_down</code>), a leader Sentinel is elected, promotes the best replica and repoints the others. Clients ask Sentinel where the master is instead of hard-coding it. Writes the old master acked but had not replicated are lost. <code>min-replicas-to-write</code> makes a master refuse writes when fewer replicas are connected, which bounds that loss.',
  },
  diagram: {
    aria: 'Replication topology: master, replicas and Sentinels',
    master: 'master',
    replica: 'replica',
    down: 'down',
    unreachable: 'unreachable',
    offset: 'offset {{v}}',
    lag: 'lag {{v}} B',
    noLink: 'link down',
    sentinelMaster: 'master :{{port}}',
    caption: "Quorum {{quorum}} of {{total}} Sentinels. Arrows: the replication stream, dashed red when a replica's link is down.",
  },
  probe: {
    title: 'Probe: one write through the Sentinel client every {{ms}} ms',
    aria: 'Probe results over time',
    ok: 'ok, master :{{port}}',
    downtime: 'Writes failed for about {{v}} s (first failed probe to first successful one).',
    failing: 'Writes are still failing.',
    none: 'No probe failed.',
    masters: 'Masters seen: {{list}}.',
    noMasters: 'none',
  },
  start: 'Start the stack: docker compose -f deploy/compose.replication.yaml up -d --wait',
  controls: {
    reads: 'Reads',
    write: 'Write',
    readMany: 'Read from replicas ×{{n}}',
    failover: 'Failover',
    probe: 'Probe 30 s',
    refresh: 'Refresh',
    hint: 'Probe 30 s: watch writes while you stop the master container by hand (see the README).',
  },
  notes: {
    accepted: 'Sentinel :{{port}} accepted SENTINEL FAILOVER. Probing for 15 s…',
    refused: 'Failover refused: {{error}}',
    done: 'Failover through Sentinel :{{port}} done. The demoted master may show "link down" until it resyncs.',
  },
  write: {
    title: 'INCR on :{{port}} → {{value}}',
    replica: 'Replica',
    before: 'Right after',
    after: 'After WAIT',
    acked_one: '<code>WAIT 2 100</code> → {{count}} replica acknowledged. Red: a stale or failed read.',
    acked_other: '<code>WAIT 2 100</code> → {{count}} replicas acknowledged. Red: a stale or failed read.',
  },
  reads: {
    title: 'Reads spread over replicas',
  },
};

const ru: Ru<typeof en> = {
  title: 'Репликация и Sentinel',
  s: '{{v}} с',
  intro: {
    async:
      'Репликация асинхронная: мастер сначала отвечает клиенту и только потом передаёт каждую запись репликам. Каждый узел ведёт смещение репликации (сколько байт этого потока он применил); реплика, чьё смещение меньше, чем у мастера, отстаёт, и чтение с неё может вернуть устаревшие данные. На одной машине реплики обычно успевают догнать мастера до следующей команды, поэтому здесь устаревшие чтения редки, а по сети — нет.',
    wait: '<code>WAIT numreplicas timeout</code> ждёт, пока столько реплик не подтвердят записи клиента. Это делает запись полусинхронной, но не надёжной: подтвердившая реплика всё равно может потерять её при перезапуске, а при failover (переключении на реплику) может быть выбрана реплика, которая её не получила. Ещё реплики масштабируют чтение: распределяйте GET по ним и миритесь со слегка устаревшими ответами.',
    sentinel:
      'Sentinel следят за мастером. Тот, кто не получает ответа дольше <code>down-after-milliseconds</code>, считает мастер субъективно недоступным (<code>s_down</code>); когда с этим соглашается кворум, мастер становится объективно недоступным (<code>o_down</code>): Sentinel выбирают лидера, тот повышает лучшую реплику до мастера и переключает на неё остальные. Клиенты не прописывают адрес мастера, а спрашивают его у Sentinel. Записи, которые старый мастер подтвердил, но не успел реплицировать, теряются. <code>min-replicas-to-write</code> заставляет мастер отклонять записи, когда подключено меньше реплик, и этим ограничивает потери.',
  },
  diagram: {
    aria: 'Топология репликации: мастер, реплики и Sentinel',
    master: 'мастер',
    replica: 'реплика',
    down: 'упал',
    unreachable: 'недоступен',
    offset: 'смещ. {{v}}',
    lag: 'отстаёт {{v}} Б',
    noLink: 'нет связи',
    sentinelMaster: 'мастер :{{port}}',
    caption: 'Кворум: {{quorum}} из {{total}} Sentinel. Стрелки — поток репликации; красный пунктир, если связь реплики с мастером оборвана.',
  },
  probe: {
    title: 'Проба: одна запись через клиент Sentinel каждые {{ms}} мс',
    aria: 'Результаты проб во времени',
    ok: 'успех, мастер :{{port}}',
    downtime: 'Записи не проходили около {{v}} с (от первой неудачной пробы до первой успешной).',
    failing: 'Записи всё ещё не проходят.',
    none: 'Ни одна проба не упала.',
    masters: 'Мастера по ходу проб: {{list}}.',
    noMasters: 'нет',
  },
  start: 'Запустите стенд: docker compose -f deploy/compose.replication.yaml up -d --wait',
  controls: {
    reads: 'Чтений',
    write: 'Записать',
    readMany: 'Прочитать с реплик ×{{n}}',
    failover: 'Failover',
    probe: 'Проба 30 с',
    refresh: 'Обновить',
    hint: 'Проба 30 с: следите за записями, пока вручную останавливаете контейнер мастера (см. README).',
  },
  notes: {
    accepted: 'Sentinel :{{port}} принял SENTINEL FAILOVER. Пробуем запись 15 с…',
    refused: 'Failover отклонён: {{error}}',
    done: 'Failover через Sentinel :{{port}} завершён. Пониженный мастер может показывать «нет связи», пока не досинхронизируется.',
  },
  write: {
    title: 'INCR на :{{port}} → {{value}}',
    replica: 'Узел',
    before: 'Сразу после',
    after: 'После WAIT',
    acked_one: '<code>WAIT 2 100</code> → подтвердила {{count}} реплика. Красным — устаревшее или неудачное чтение.',
    acked_few: '<code>WAIT 2 100</code> → подтвердили {{count}} реплики. Красным — устаревшее или неудачное чтение.',
    acked_many: '<code>WAIT 2 100</code> → подтвердили {{count}} реплик. Красным — устаревшее или неудачное чтение.',
    acked_other: '<code>WAIT 2 100</code> → подтвердили {{count}} реплики. Красным — устаревшее или неудачное чтение.',
  },
  reads: {
    title: 'Чтения, распределённые по репликам',
  },
};

addNs('replication', en, ru);

declare module 'i18next' {
  interface ResourceNamespaceMap {
    replication: typeof en;
  }
}
