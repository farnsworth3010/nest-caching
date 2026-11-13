export const DIM = 256;

const STOP_WORDS = new Set('a an the i my me do does how to can is are what of in on for you your it please should with and or как я мне мой моя его её это ли у вас'.split(' '));

const hash = (s: string) => {
  let h = 2166136261;

  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);

  return h >>> 0;
};

// shortcut: word + char-trigram hashing only matches shared words, not meaning; a real embedding model replaces it.
export function embed(text: string) {
  const v = new Array<number>(DIM).fill(0);
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter((w) => !STOP_WORDS.has(w)) ?? [];

  for (const w of words) {
    v[hash(w) % DIM] += 1;

    const padded = `#${w}#`;
    for (let i = 0; i + 3 <= padded.length; i++) v[hash(padded.slice(i, i + 3)) % DIM] += 0.5;
  }

  const norm = Math.hypot(...v) || 1;

  return v.map((x) => +(x / norm).toFixed(4));
}

export const tokens = (text: string) => Math.ceil((text.match(/\S+/g)?.length ?? 0) * 1.3);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Simulated model: a fixed delay and a templated answer. No model or API is called.
export async function fakeLlm(prompt: string, answer: string, delayMs = 1200) {
  await sleep(delayMs);

  const text = `[simulated model] ${answer}`;

  return { text, promptTokens: tokens(prompt), answerTokens: tokens(text) };
}
