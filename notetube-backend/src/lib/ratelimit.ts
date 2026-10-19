import { AppError } from "./errors.js";

/**
 * Sliding-window limiter, in memory. Fine for a single instance; if you scale out, move the counters
 * to Postgres or Redis (the interface stays the same).
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private max: number, private windowMs: number) {}

  check(key: string, now = Date.now()): void {
    const since = now - this.windowMs;
    const arr = (this.hits.get(key) ?? []).filter((t) => t > since);
    if (arr.length >= this.max) {
      const retry = Math.max(1, Math.ceil((arr[0]! + this.windowMs - now) / 1000));
      this.hits.set(key, arr);
      throw new AppError("RATE_LIMITED", "Too many requests. Please slow down.", { retry_after: retry });
    }
    arr.push(now);
    this.hits.set(key, arr);
    if (this.hits.size > 50_000) this.sweep(now);
  }

  reset() { this.hits.clear(); }

  private sweep(now: number) {
    for (const [k, v] of this.hits) if (!v.some((t) => t > now - this.windowMs)) this.hits.delete(k);
  }
}
