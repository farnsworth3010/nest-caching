export type Command = { cmd: string; args: string[]; reply: unknown; ms: number };

export async function api<T>(path: string, init?: RequestInit): Promise<T & { commands: Command[] }> {
  const res = await fetch(`/api${path}`, init);

  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

  return res.json();
}
