// Shared GitHub access for Pages Functions: headers (with an optional free
// GITHUB_TOKEN to lift the rate limit), a timeout, an edge-cache helper that
// never caches failures, and a JSON response helper.

export const GITHUB_API = 'https://api.github.com';
const CACHE_ORIGIN = 'https://zw-cache.internal';

export function githubHeaders(env) {
  const headers = { 'User-Agent': 'zohnwheeler-portfolio', Accept: 'application/vnd.github+json' };
  if (env?.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  return headers;
}

export function gh(path, { env, fetchImpl = fetch, timeoutMs = 2500, signal } = {}) {
  return fetchImpl(`${GITHUB_API}${path}`, { headers: githubHeaders(env), signal: signal ?? AbortSignal.timeout(timeoutMs) });
}

export async function cached(key, ttl, produce) {
  const cache = globalThis.caches?.default;
  const req = new Request(`${CACHE_ORIGIN}/${key}`);
  if (cache) {
    try {
      const hit = await cache.match(req);
      if (hit) return await hit.json();
    } catch { /* cache read failed: produce a fresh value */ }
  }
  const value = await produce();
  if (cache) {
    try {
      await cache.put(req, new Response(JSON.stringify(value), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${ttl}` },
      }));
    } catch { /* cache write failed: the value is still good */ }
  }
  return value;
}

export function json(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
