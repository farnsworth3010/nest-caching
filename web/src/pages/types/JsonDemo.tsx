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
  title: 'JSON',
  group: 'Redis 8',
  about:
    'Redis 8 ships JSON as a native type: a document is stored as a tree, and commands address parts of it with JSONPath. Compare the buttons: JSON.NUMINCRBY changes one number on the server in one small command, while the String version has to GET the whole document, change it in the app and SET it all back (and two clients doing that at once lose an update).',
  uses: ['Documents with nested fields you update partially', 'Objects you search with the Query Engine (FT.CREATE ON JSON)', 'Replacing "serialize the whole object into a String"'],
  cheats: [
    ['JSON.SET key $ <json>', 'Write a document (or a path)', 'O(M+N)'],
    ['JSON.GET key [path]', 'Read the document or a part', 'O(N)'],
    ['JSON.NUMINCRBY key $.total 9.99', 'Add to a number in place', 'O(1) per path'],
    ['JSON.ARRAPPEND key $.items <json>', 'Append to an array in place', 'O(1) per path'],
  ],
  actions: [
    ['set', 'JSON.SET order'],
    ['incr', 'JSON.NUMINCRBY $.total'],
    ['append', 'JSON.ARRAPPEND $.items'],
    ['name', 'JSON.GET $.customer.name'],
    ['string', 'Same +9.99 as a String: GET + SET'],
  ],
  View,
};
