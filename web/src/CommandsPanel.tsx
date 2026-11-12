import type { Command } from './api';

const MAX = 160;

// Long values (cached JSON, INFO output) are cut; the full text stays in the tooltip.
function Clip({ text }: { text: string }) {
  return <span title={text.length > MAX ? text : undefined}>{text.length > MAX ? `${text.slice(0, MAX)}…` : text}</span>;
}

export function CommandsPanel({ commands }: { commands: Command[] }) {
  return (
    <section className="commands">
      <h2>Redis commands</h2>
      {commands.length === 0 ? (
        <p>No Redis commands in this request.</p>
      ) : (
        <ol>
          {commands.map((c, i) => (
            <li key={i}>
              <code>
                {c.cmd} <Clip text={c.args.join(' ')} />
              </code>
              <span>
                → <Clip text={JSON.stringify(c.reply)} />
              </span>
              <small>{c.ms} ms</small>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
