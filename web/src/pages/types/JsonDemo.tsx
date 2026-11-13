import type { TypeDemo, ViewProps } from './types';

type State = { doc: unknown; string: string | null };

function View({ state }: ViewProps<State>) {
  return (
    <div className="columns">
      <div>
        <h3>
          <code>demo:json:order</code> (JSON)
        </h3>
        {state.doc ? <pre>{JSON.stringify(state.doc, null, 2)}</pre> : <p>(nil)</p>}
      </div>
      <div>
        <h3>
          <code>demo:json:order-string</code> (String)
        </h3>
        {state.string ? <pre>{JSON.stringify(JSON.parse(state.string), null, 2)}</pre> : <p>(nil)</p>}
      </div>
    </div>
  );
}

export const json: TypeDemo = {
  id: 'json',
  group: 'Redis 8',
  cheats: [
    'JSON.SET key $ <json>',
    'JSON.GET key [path]',
    'JSON.NUMINCRBY key $.total 9.99',
    'JSON.ARRAPPEND key $.items <json>',
  ],
  View,
};
