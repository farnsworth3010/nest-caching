import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { api, type Command } from '../api';
import { CommandsPanel } from '../CommandsPanel';
import './ReplicationPage.i18n';

type Node = { port: number; up: boolean; role?: string; offset?: number; masterPort?: number; link?: string; error?: string };
type SentinelView = { port: number; up: boolean; master?: number; flags?: string; quorum?: number; failover?: string; error?: string };
type Topology = { nodes: Node[]; sentinels: SentinelView[]; sentinelReplicas: { port: number; flags: string }[] };
type Read = { node: number; value?: string | null; error?: string };
type Write = { master?: number; value: string; before: Read[]; acked: number; after: Read[] };
type Probe = { t: number; ok: boolean; master?: number; error?: string };

const PROBE_MS = 500;
const W = 720;

// Downtime: from the first failed probe to the next successful one.
function downtime(probes: Probe[]) {
  const first = probes.findIndex((p) => !p.ok);
  if (first < 0) return undefined;

  const back = probes.slice(first).find((p) => p.ok);
  return back ? back.t - probes[first].t : undefined;
}

function TopologyDiagram({ topo }: { topo: Topology }) {
  // Sentinel's answer decides which node is the master; INFO on the nodes can lag behind during a failover.
  const masterPort = topo.sentinels.find((s) => s.up)?.master ?? topo.nodes.find((n) => n.role === 'master')?.port;
  const master = topo.nodes.find((n) => n.port === masterPort);
  const replicas = topo.nodes.filter((n) => n !== master);
  const pos = new Map<number, { x: number; y: number }>([[masterPort ?? 0, { x: 300, y: 120 }]]);
  const { t } = useTranslation('replication');

  replicas.forEach((n, i) => pos.set(n.port, { x: [90, 510, 300][i], y: 230 }));

  const box = (n: Node | undefined, isMaster: boolean) => {
    if (!n) return null;

    const { x, y } = pos.get(n.port)!;
    const lag = master?.offset !== undefined && n.offset !== undefined && !isMaster ? master.offset - n.offset : undefined;

    return (
      <g key={n.port} className={`node ${n.up ? (isMaster ? 'master' : 'replica') : 'down'}`}>
        <rect x={x} y={y} width="120" height="58" rx="8" />
        <text x={x + 60} y={y + 20} textAnchor="middle" className="box-label">
          :{n.port} {t(n.up ? (isMaster ? 'diagram.master' : 'diagram.replica') : 'diagram.down')}
        </text>
        <text x={x + 60} y={y + 37} textAnchor="middle">
          {n.up ? t('diagram.offset', { v: n.offset }) : t('diagram.unreachable')}
        </text>
        {lag !== undefined && (
          <text x={x + 60} y={y + 52} textAnchor="middle">
            {n.link === 'up' ? t('diagram.lag', { v: lag }) : t('diagram.noLink')}
          </text>
        )}
      </g>
    );
  };

  return (
    <figure className="flow replication">
      <svg viewBox={`0 0 ${W} 300`} role="img" aria-label={t('diagram.aria')}>
        {topo.sentinels.map((s, i) => {
          const down = !s.up || /o_down|s_down/.test(s.flags ?? '');

          return (
            <g key={s.port} className={`sentinel ${s.up ? '' : 'down'}`}>
              <rect x={60 + i * 210} y="10" width="180" height="52" rx="8" />
              <text x={150 + i * 210} y="30" textAnchor="middle" className="box-label">
                Sentinel :{s.port}
              </text>
              <text x={150 + i * 210} y="50" textAnchor="middle" className={down ? 'alert' : undefined}>
                {s.up ? `${t('diagram.sentinelMaster', { port: s.master })}${s.flags !== 'master' ? ` (${s.flags})` : ''}` : t('diagram.unreachable')}
              </text>
            </g>
          );
        })}
        {master &&
          replicas.map((r) => {
            const to = pos.get(r.port)!;
            const ok = r.up && r.link === 'up' && r.masterPort === master.port;

            return <line key={r.port} className={`link ${ok ? 'ok' : 'broken'}`} x1="360" y1="178" x2={to.x + 60} y2={to.y} />;
          })}
        {box(master, true)}
        {replicas.map((n) => box(n, false))}
      </svg>
      <figcaption>
        {t('diagram.caption', { quorum: topo.sentinels.find((s) => s.up)?.quorum ?? '?', total: topo.sentinels.length })}
      </figcaption>
    </figure>
  );
}

function ProbeTimeline({ probes }: { probes: Probe[] }) {
  const end = Math.max(1, ...probes.map((p) => p.t));
  const x = (t: number) => 20 + (t / end) * (W - 40);
  const gap = downtime(probes);
  const { t } = useTranslation('replication');

  return (
    <section className="card">
      <h2>{t('probe.title', { ms: PROBE_MS })}</h2>
      <svg className="probes" viewBox={`0 0 ${W} 56`} role="img" aria-label={t('probe.aria')}>
        {probes.map((p, i) => (
          <rect key={i} className={p.ok ? 'ok' : 'failed'} x={x(p.t) - 4} y="6" width="8" height="24">
            <title>{p.ok ? t('probe.ok', { port: p.master }) : p.error}</title>
          </rect>
        ))}
        <text x="20" y="50">
          {t('s', { v: 0 })}
        </text>
        <text x={W - 20} y="50" textAnchor="end">
          {t('s', { v: (end / 1000).toFixed(1) })}
        </text>
      </svg>
      <p>
        {gap !== undefined
          ? t('probe.downtime', { v: (gap / 1000).toFixed(1) })
          : probes.some((p) => !p.ok)
            ? t('probe.failing')
            : t('probe.none')}{' '}
        {t('probe.masters', { list: [...new Set(probes.filter((p) => p.ok).map((p) => `:${p.master}`))].join(' → ') || t('probe.noMasters') })}
      </p>
    </section>
  );
}

export function ReplicationPage() {
  const [topo, setTopo] = useState<Topology>();
  const [write, setWrite] = useState<Write>();
  const [reads, setReads] = useState<Read[]>();
  const [n, setN] = useState(6);
  const [probes, setProbes] = useState<Probe[]>([]);
  const [commands, setCommands] = useState<Command[]>([]);
  const [note, setNote] = useState<string>();
  const [busy, setBusy] = useState(false);
  const { t } = useTranslation('replication');

  const refresh = async (show = false) => {
    const res = await api<Topology>('/replication');

    setTopo(res);
    if (show) setCommands(res.commands);
  };

  useEffect(() => {
    refresh().catch((err: Error) => setNote(err.message));
  }, []);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setNote(undefined);

    try {
      await fn();
    } catch (err) {
      setNote((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doWrite = async () => {
    const res = await api<Write>('/replication/write', { method: 'POST' });

    setWrite(res);
    setCommands(res.commands);
    await refresh();
  };

  const doReads = async () => {
    const res = await api<{ reads: Read[] }>(`/replication/reads?n=${n}`, { method: 'POST' });

    setReads(res.reads);
    setCommands(res.commands);
  };

  // Probes twice a second and redraws the topology every other probe, so roles swap on screen.
  const watch = async (seconds: number) => {
    const start = performance.now();
    const list: Probe[] = [];

    setProbes([]);

    for (let i = 0; performance.now() - start < seconds * 1000; i++) {
      const t = Math.round(performance.now() - start);
      const res = await api<Omit<Probe, 't'>>('/replication/probe', { method: 'POST' }).catch((err: Error) => ({ ok: false, error: err.message }));

      list.push({ ...res, t });
      setProbes([...list]);
      if (i % 2 === 0) await refresh().catch(() => {});

      await new Promise((r) => setTimeout(r, Math.max(0, start + (i + 1) * PROBE_MS - performance.now())));
    }

    await refresh();
  };

  const failover = async () => {
    const res = await api<{ ok: boolean; reply?: string; error?: string; sentinel?: number }>('/replication/failover', { method: 'POST' });

    setCommands(res.commands);
    setNote(res.ok ? t('notes.accepted', { port: res.sentinel }) : t('notes.refused', { error: res.error }));
    if (!res.ok) return;

    await watch(15);
    setNote(t('notes.done', { port: res.sentinel }));
  };

  return (
    <>
      <h1>{t('title')}</h1>
      <section className="intro">
        <p>{t('intro.async')}</p>
        <p>
          <Trans t={t} i18nKey="intro.wait" components={{ code: <code /> }} />
        </p>
        <p>
          <Trans t={t} i18nKey="intro.sentinel" components={{ code: <code /> }} />
        </p>
      </section>

      {topo ? <TopologyDiagram topo={topo} /> : <p className="hint">{t('start')}</p>}

      <section className="card controls">
        <label>
          {t('controls.reads')}
          <input type="number" min={1} max={50} value={n} onChange={(e) => setN(e.target.valueAsNumber || 1)} />
        </label>
        <div className="buttons">
          <button disabled={busy} onClick={() => act(doWrite)}>
            {t('controls.write')}
          </button>
          <button disabled={busy} onClick={() => act(doReads)}>
            {t('controls.readMany', { n })}
          </button>
          <button disabled={busy} onClick={() => act(failover)}>
            {t('controls.failover')}
          </button>
          <button disabled={busy} onClick={() => act(() => watch(30))}>
            {t('controls.probe')}
          </button>
          <button disabled={busy} onClick={() => act(() => refresh(true))}>
            {t('controls.refresh')}
          </button>
        </div>
        <p className="hint">{t('controls.hint')}</p>
        {note && <p className="note">{note}</p>}
      </section>

      {probes.length > 0 && <ProbeTimeline probes={probes} />}

      <div className="columns">
        {write && (
          <section className="card">
            <h2>{t('write.title', { port: write.master, value: write.value })}</h2>
            <table>
              <thead>
                <tr>
                  <th>{t('write.replica')}</th>
                  <th>{t('write.before')}</th>
                  <th>{t('write.after')}</th>
                </tr>
              </thead>
              <tbody>
                {write.before.map((b, i) => (
                  <tr key={b.node}>
                    <td>:{b.node}</td>
                    <td className={b.value !== write.value ? 'error' : undefined}>{b.error ?? b.value ?? 'nil'}</td>
                    <td className={write.after[i].value !== write.value ? 'error' : undefined}>{write.after[i].error ?? write.after[i].value ?? 'nil'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="hint">
              <Trans t={t} i18nKey="write.acked" count={write.acked} components={{ code: <code /> }} />
            </p>
          </section>
        )}
        {reads && (
          <section className="card">
            <h2>{t('reads.title')}</h2>
            <div className="boxes">
              {reads.map((r, i) => (
                <span key={i} className="box">
                  :{r.node} → {r.error ?? r.value ?? 'nil'}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>

      <CommandsPanel commands={commands} />
    </>
  );
}
