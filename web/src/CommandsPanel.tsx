import type { Command } from './api';

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
                {c.cmd} {c.args.join(' ')}
              </code>
              <span>→ {JSON.stringify(c.reply)}</span>
              <small>{c.ms} ms</small>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
