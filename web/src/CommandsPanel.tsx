import { useTranslation } from 'react-i18next';
import type { Command } from './api';
import './CommandsPanel.i18n';

const MAX = 160;
const MAX_ROWS = 25;

// Long values (cached JSON, INFO output) are cut; the full text stays in the tooltip.
function Clip({ text }: { text: string }) {
  return <span title={text.length > MAX ? text : undefined}>{text.length > MAX ? `${text.slice(0, MAX)}…` : text}</span>;
}

function Rows({ commands }: { commands: Command[] }) {
  const { t } = useTranslation('commands');

  return (
    <ol>
      {commands.slice(0, MAX_ROWS).map((c, i) => (
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
      {commands.length > MAX_ROWS && <li className="more">{t('more', { count: commands.length - MAX_ROWS })}</li>}
    </ol>
  );
}

// `split` marks where the commands that only refresh the page's visualization begin.
export function CommandsPanel({ commands, split = commands.length }: { commands: Command[]; split?: number }) {
  const own = commands.slice(0, split);
  const refresh = commands.slice(split);
  const { t } = useTranslation('commands');

  return (
    <section className="commands">
      <h2>{t('title')}</h2>
      {own.length === 0 ? <p>{t('none')}</p> : <Rows commands={own} />}
      {refresh.length > 0 && (
        <div className="refresh">
          <h3>{t('refresh')}</h3>
          <Rows commands={refresh} />
        </div>
      )}
    </section>
  );
}
