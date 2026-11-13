import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DIM, embed } from '../src/real-world/simulated.ts';

const cosine = (a: number[], b: number[]) => a.reduce((sum, x, i) => sum + x * b[i], 0);

test('paraphrases land above the semantic cache threshold, unrelated questions far below', () => {
  const reset = embed('How do I reset my password?');

  assert.equal(reset.length, DIM);
  assert.ok(Math.abs(cosine(reset, reset) - 1) < 1e-3);
  assert.ok(cosine(reset, embed('how to reset password')) > 0.8);
  assert.ok(cosine(reset, embed('I forgot my password, how can I reset it?')) > 0.8);
  assert.ok(cosine(reset, embed('What are your opening hours?')) < 0.3);

  // Cyrillic must produce a real vector, not zeros.
  const ru = embed('Как сбросить пароль?');

  assert.ok(cosine(ru, embed('Я забыл пароль, как его сбросить?')) > 0.8);
  assert.ok(cosine(ru, embed('Какие у вас часы работы?')) < 0.3);
});
