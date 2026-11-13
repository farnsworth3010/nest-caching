import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { api, type Command } from '../api';
import { CommandsPanel } from '../CommandsPanel';
import './ClusterPage.i18n';

const SLOTS = 16384;
const W = 720;
const COLORS = ['#0969da', '#bc4c00', '#1a7f37', '#8250df', '#bf3989', '#9a6700', '#1b7c83', '#cf222e'];

type Node = {
  id: string;
  port: number;
  role: 'master' | 'replica';
  masterId?: string;
  failing: boolean;
  ranges: [number, number][];
  migrating: number[];
  importing: number[];
  keys?: number;
};
type State = { nodes: Node[]; spare: number[] };
type Response = State & { commands: Command[]; split?: number; commandCount?: number };
type KeySlot = { key: string; slot: number };
type Hashtag = { keys: KeySlot[]; values: string[]; taggedCopy: string; plainCopy: string };
type Reshard = { from: number; to: number; slots: number[]; keysMoved: number; checked: { key: string; value: string | null }[]; redirects: Command[] };

const color = (port: number) => COLORS[(port - 7000) % COLORS.length];
const x = (slot: number) => (slot / SLOTS) * W;
const masters = (nodes: Node[]) => nodes.filter((n) => n.role === 'master' && n.ranges.length > 0);
const owner = (nodes: Node[], slot: number) => masters(nodes).find((m) => m.ranges.some(([a, b]) => slot >= a && slot <= b))?.port;
const count = (n: Node) => n.ranges.reduce((sum, [a, b]) => sum + b - a + 1, 0);
const ranges = (n: Node) => n.ranges.map(([a, b]) => (a === b ? a : `${a}–${b}`)).join(', ');

function SlotBar({ nodes, keys, moved }: { nodes: Node[]; keys: KeySlot[]; moved: number[] }) {
  const inFlight = nodes.flatMap((n) => [...n.migrating, ...n.importing]);
  const { t } = useTranslation('cluster');

  return (
    <svg className="slot-bar" viewBox={`0 0 ${W} 74`} role="img" aria-label={t('map.aria')}>
      {keys.map((k) => (
        <line key={k.key} className="key" x1={x(k.slot)} x2={x(k.slot)} y1={4} y2={14} />
      ))}
      {masters(nodes).flatMap((m) =>
        m.ranges.map(([a, b]) => <rect key={`${m.port}-${a}`} x={x(a)} y={18} width={Math.max(1, x(b + 1) - x(a))} height={28} fill={color(m.port)} />),
      )}
      {moved.map((s) => (
        <rect key={`m${s}`} className="moved" x={x(s)} y={48} width={Math.max(1, W / SLOTS)} height={5} />
      ))}
      {inFlight.map((s) => (
        <rect key={`f${s}`} className="in-flight" x={x(s) - 2} y={16} width={4} height={32} />
      ))}
      {[0, 5461, 10923, 16383].map((s) => (
        <text key={s} x={x(s)} y={68} textAnchor={s === 0 ? 'start' : s === 16383 ? 'end' : 'middle'}>
          {s}
        </text>
      ))}
    </svg>
  );
}

function NodeCards({ state }: { state: State }) {
  const shards = state.nodes.filter((n) => n.role === 'master');
  const { t } = useTranslation('cluster');
  const keys = (n: Node) => (n.keys === undefined ? t('node.keysUnknown') : t('node.keys', { count: n.keys }));

  return (
    <ul className="shards">
      {shards.map((m) => (
        <li key={m.id} style={{ borderTopColor: color(m.port) }}>
          <strong>
            :{m.port} {t('node.master')}
            {m.failing && <span className="error">{t('node.failing')}</span>}
          </strong>
          <small title={m.id}>id {m.id.slice(0, 8)}…</small>
          <span>
            {t('node.slots', { count: count(m) })}
            {m.ranges.length > 0 && `: ${ranges(m)}`}
          </span>
          <span>{keys(m)}</span>
          {state.nodes
            .filter((r) => r.masterId === m.id)
            .map((r) => (
              <span key={r.id} className="replica">
                ↳ :{r.port} {t('node.replica')}, {keys(r)}
                {r.failing && <span className="error">{t('node.failing')}</span>}
              </span>
            ))}
        </li>
      ))}
      {state.spare.map((port) => (
        <li key={port} className="spare">
          <strong>
            :{port} {t('node.spare')}
          </strong>
          <span>{t('node.notJoined')}</span>
        </li>
      ))}
    </ul>
  );
}

function Distribution({ nodes, keys }: { nodes: Node[]; keys: KeySlot[] }) {
  const per = masters(nodes).map((m) => ({ port: m.port, n: keys.filter((k) => owner(nodes, k.slot) === m.port).length }));
  const max = Math.max(1, ...per.map((p) => p.n));
  const { t } = useTranslation('cluster');

  return (
    <ol className="bars">
      {per.map((p) => (
        <li key={p.port}>
          <span>:{p.port}</span>
          <span className="bar" style={{ width: `${(p.n / max) * 100}%`, background: color(p.port) }} />
          <strong>{t('node.keys', { count: p.n })}</strong>
        </li>
      ))}
    </ol>
  );
}

export function ClusterPage() {
  const [state, setState] = useState<State>();
  const [commands, setCommands] = useState<Command[]>([]);
  const [split, setSplit] = useState<number>();
  const [keys, setKeys] = useState<KeySlot[]>([]);
  const [hashtag, setHashtag] = useState<Hashtag>();
  const [reshard, setReshard] = useState<Reshard>();
  const [n, setN] = useState(500);
  const [slots, setSlots] = useState(200);
  const [from, setFrom] = useState(7000);
  const [to, setTo] = useState(7006);
  const [note, setNote] = useState<string>();
  const [busy, setBusy] = useState(false);
  const { t } = useTranslation('cluster');

  const show = (res: Response) => {
    setState(res);
    setCommands(res.commands);
    setSplit(res.split);
    if (res.commandCount && res.commandCount > res.commands.length) setNote(t('notes.shown', { shown: res.split, total: res.commandCount }));
  };

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setNote(undefined);

    try {
      await fn();
    } catch (err) {
      // The API's message says why, including how to start the cluster on a 503.
      setNote((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => show(await api<Response>('/cluster'));

  useEffect(() => {
    act(refresh);
  }, []);

  const writeKeys = async () => {
    const res = await api<Response & { keys: KeySlot[] }>(`/cluster/keys?n=${n}`, { method: 'POST' });

    setKeys(res.keys);
    show(res);
  };

  const runHashtag = async () => {
    const res = await api<Response & Hashtag>('/cluster/hashtag', { method: 'POST' });

    setHashtag(res);
    show(res);
  };

  const addNode = async () => show(await api<Response>('/cluster/add-node', { method: 'POST' }));

  // Polls the slot map while the slots move, so the bar shows the slot currently MIGRATING/IMPORTING.
  // Each poll waits for the previous one, so a slow node cannot pile requests up.
  const runReshard = async () => {
    let live = true;
    const poll = async () => {
      while (live) {
        await api<State>('/cluster').then((s) => live && setState(s), () => {});
        await new Promise((r) => setTimeout(r, 150));
      }
    };

    poll();

    try {
      const res = await api<Response & Reshard>(`/cluster/reshard?from=${src}&to=${dst}&slots=${slots}`, { method: 'POST' });

      live = false;
      setReshard(res);
      show(res);
    } finally {
      live = false;
    }
  };

  const reset = async () => {
    const res = await api<Response & { slotsMovedBack: number; removed: number[] }>('/cluster/reset', { method: 'POST' });

    setReshard(undefined);
    show(res);
    setNote(t('notes.reset', { count: res.slotsMovedBack, removed: res.removed.map((p) => `:${p}`).join(', ') || t('notes.noNodes') }));
  };

  const ports = state ? state.nodes.filter((m) => m.role === 'master' && !m.failing).map((m) => m.port) : [];
  // A chosen port can leave the list (7006 before Add node or after Reset); fall back to one that exists,
  // so the selects show exactly what the button sends.
  const src = ports.includes(from) ? from : ports[0];
  const dst = ports.includes(to) ? to : ports.find((p) => p !== src);

  return (
    <>
      <h1>Redis Cluster</h1>
      <section className="intro">
        {(['slots', 'hashtags', 'redirects', 'failover', 'scaling'] as const).map((k) => (
          <p key={k}>
            <Trans t={t} i18nKey={`intro.${k}`} components={{ strong: <strong />, code: <code /> }} />
          </p>
        ))}
      </section>

      <section className="card controls">
        <label>
          {t('controls.keys')}
          <input type="number" min={1} max={1000} value={n} onChange={(e) => setN(Number(e.target.value))} />
        </label>
        <label>
          {t('controls.from')}
          <select value={src} onChange={(e) => setFrom(Number(e.target.value))}>
            {ports.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          {t('controls.to')}
          <select value={dst} onChange={(e) => setTo(Number(e.target.value))}>
            {ports.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          {t('controls.slots')}
          <input type="number" min={1} max={200} value={slots} onChange={(e) => setSlots(Number(e.target.value))} />
        </label>
        <div className="buttons">
          <button disabled={busy} onClick={() => act(writeKeys)}>
            {t('controls.write', { count: n })}
          </button>
          <button disabled={busy} onClick={() => act(runHashtag)}>
            {t('controls.hashtag')}
          </button>
          <button disabled={busy || state?.spare.length !== 2} onClick={() => act(addNode)}>
            {t('controls.addNode')}
          </button>
          <button disabled={busy || src === undefined || dst === undefined || src === dst} onClick={() => act(runReshard)}>
            {t('controls.move', { count: slots, src, dst })}
          </button>
          <button disabled={busy} onClick={() => act(reset)}>
            {t('controls.reset')}
          </button>
          <button disabled={busy} onClick={() => act(refresh)}>
            {t('controls.refresh')}
          </button>
        </div>
        <p className="hint">
          <Trans t={t} i18nKey="controls.hint" components={{ code: <code /> }} />
        </p>
        {note && <p className="note">{note}</p>}
      </section>

      {state && (
        <section className="card">
          <h2>{t('map.title')}</h2>
          <SlotBar nodes={state.nodes} keys={keys} moved={reshard?.slots ?? []} />
          <p className="hint legend">
            {masters(state.nodes).map((m) => (
              <span key={m.port} style={{ background: color(m.port) }}>
                :{m.port}
              </span>
            ))}{' '}
            {t('map.ticks')} <span className="moved">{t('map.moved')}</span> <span className="in-flight">{t('map.inFlight')}</span>
          </p>
          <NodeCards state={state} />
        </section>
      )}

      {state && keys.length > 0 && (
        <section className="card">
          <h2>{t('landed', { count: keys.length })}</h2>
          <Distribution nodes={state.nodes} keys={keys} />
        </section>
      )}

      {state && hashtag && (
        <section className="card">
          <h2>{t('hashtag.title')}</h2>
          <table className="hashtag">
            <thead>
              <tr>
                <th>{t('hashtag.key')}</th>
                <th>{t('hashtag.slot')}</th>
                <th>{t('hashtag.node')}</th>
              </tr>
            </thead>
            <tbody>
              {hashtag.keys.map((k) => (
                <tr key={k.key}>
                  <td>
                    <code>{k.key}</code>
                  </td>
                  <td>{k.slot}</td>
                  <td>:{owner(state.nodes, k.slot)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl>
            <dt>{t('hashtag.mget')}</dt>
            <dd>{JSON.stringify(hashtag.values)}</dd>
            <dt>{t('hashtag.copy')}</dt>
            <dd>{hashtag.taggedCopy}</dd>
            <dt>{t('hashtag.plainCopy')}</dt>
            <dd className="error">{hashtag.plainCopy}</dd>
          </dl>
        </section>
      )}

      {reshard && (
        <section className="card">
          <h2>
            {t('reshard.title', { count: reshard.slots.length, first: reshard.slots[0], last: reshard.slots.at(-1), from: reshard.from, to: reshard.to })},{' '}
            {t('node.keys', { count: reshard.keysMoved })}
          </h2>
          <p className="hint">{t('reshard.checked')}</p>
          <ul>
            {reshard.checked.map((c) => (
              <li key={c.key}>
                <code>{c.key}</code> = {c.value ?? <span className="error">{t('reshard.missing')}</span>}
              </li>
            ))}
          </ul>
          <p className="hint">{t('reshard.redirects')}</p>
          <ol className="redirects">
            {reshard.redirects.map((c, i) => (
              <li key={i}>
                <code>
                  {c.cmd} {c.args.join(' ')}
                </code>{' '}
                → {String(c.reply)}
              </li>
            ))}
          </ol>
        </section>
      )}

      <CommandsPanel commands={commands} split={split} />
    </>
  );
}
