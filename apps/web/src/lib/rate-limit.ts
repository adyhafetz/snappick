/**
 * Simple per-visitor limit for the public API routes (each one costs a database query, a language-model call or a
 * PDF build). It is kept in this server's memory, so on a host that runs several server instances each instance
 * counts separately; put a shared limiter (for example the host's own rate limiting) in front for production.
 */
export function createLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return function limited(req: Request): boolean {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    const now = Date.now();
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(ip, recent);
    if (hits.size > 5000) hits.clear();
    return recent.length > max;
  };
}
