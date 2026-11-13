import { Trans, useTranslation } from 'react-i18next';
import type { TypeDemo, ViewProps } from './types';

type State = { fields: Record<string, string>; otpTtl: number | null };

function View({ state }: ViewProps<State>) {
  const { t } = useTranslation('types');
  const fields = Object.entries(state.fields);

  if (!fields.length)
    return (
      <p>
        <Trans t={t} i18nKey="hash.missing" components={{ code: <code /> }} />
      </p>
    );

  return (
    <table className="kv">
      <caption>
        <code>demo:hash:user:1</code>
      </caption>
      <tbody>
        {fields.map(([field, value]) => (
          <tr key={field}>
            <td>
              <code>{field}</code>
            </td>
            <td>{value}</td>
            <td className="hint">{field === 'otp' && state.otpTtl !== null && state.otpTtl > 0 ? t('hash.expires', { s: state.otpTtl }) : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const hash: TypeDemo = {
  id: 'hash',
  group: 'Core',
  cheats: [
    'HSET key f v [f v …]',
    'HGET key f',
    'HGETALL key',
    'HINCRBY key f n',
    'HDEL key f',
    'HEXPIRE key s FIELDS n f',
  ],
  View,
};
