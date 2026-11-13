export type Command = { cmd: string; args: string[]; reply: unknown; ms: number };

export async function api<T>(path: string, init?: RequestInit): Promise<T & { commands: Command[] }> {
  const res = await fetch(`/api${path}`, init);

  if (!res.ok) {
    // Nest errors carry the reason in `message`; a proxy error page has no JSON body.
    const body = await res.json().catch(() => undefined);

    throw new Error(`${res.status} ${res.statusText}${body?.message ? `: ${body.message}` : ''}`);
  }

  return res.json();
}
