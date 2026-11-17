/**
 * Shared proxy helpers for Next.js API Route Handlers.
 * Skips localhost backend probes when running on Vercel without an explicit API URL.
 */

export function isCloudRuntime(): boolean {
  return Boolean(process.env.VERCEL);
}

export function getCandidateBackendBases(): string[] {
  const configured = [
    process.env.INTERNAL_BACKEND_URL,
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_API_BASE,
  ].filter(Boolean) as string[];

  if (!isCloudRuntime()) {
    configured.push('http://localhost:8080', 'http://localhost:8081');
  }

  return Array.from(new Set(configured.map((b) => b.replace(/\/$/, ''))));
}

export async function proxyBackendJson<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 1800
): Promise<T | null> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const bases = getCandidateBackendBases();

  for (const base of bases) {
    try {
      const res = await fetch(`${base}${normalizedPath}`, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
      });
      if (res.ok) {
        return (await res.json()) as T;
      }
    } catch {
      // Backend offline or timed out; try next candidate
    }
  }

  return null;
}

export async function proxyBackendStream(
  path: string,
  init: RequestInit = {},
  timeoutMs = 2000,
  externalSignal?: AbortSignal
): Promise<Response | null> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const bases = getCandidateBackendBases();

  for (const base of bases) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    externalSignal?.addEventListener('abort', onAbort, { once: true });

    try {
      const res = await fetch(`${base}${normalizedPath}`, {
        ...init,
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onAbort);

      if (res.ok && res.body) {
        return res;
      }
    } catch {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onAbort);
    }
  }

  return null;
}
