const DEV_SERVER_URL = 'http://127.0.0.1:8191';
export const SERVER_URL = import.meta.env.DEV ? DEV_SERVER_URL : '';
let serverMode = false;

export function isServerMode(): boolean {
  return serverMode;
}

export async function detectServer(): Promise<boolean> {
  try {
    const pingUrl = import.meta.env.DEV ? `${DEV_SERVER_URL}/ping` : '/ping';
    const res = await fetch(pingUrl, { signal: AbortSignal.timeout(600) });
    serverMode = res.ok;
  } catch {
    serverMode = false;
  }
  return serverMode;
}

export async function sf(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
