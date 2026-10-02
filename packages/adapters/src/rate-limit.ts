/**
 * Attempt limiting, e.g. for resuming a quote: N failures within a window lock the key for a
 * period. Demo store is in memory; production would use a shared store such as Redis.
 */

export interface RateLimiter {
  /** Whether another attempt is allowed now, and if not, how long until it is. */
  check(key: string): Promise<{ allowed: true } | { allowed: false; retryAfterMs: number }>;
  recordFailure(key: string): Promise<void>;
  reset(key: string): Promise<void>;
}

export function createMemoryRateLimiter(options: { maxAttempts: number; lockoutMs: number; now?: () => number }): RateLimiter {
  const now = options.now ?? Date.now;
  const state = new Map<string, { failures: number; lockedUntil: number }>();
  return {
    async check(key) {
      const entry = state.get(key);
      if (entry && entry.lockedUntil > now()) return { allowed: false, retryAfterMs: entry.lockedUntil - now() };
      if (entry && entry.lockedUntil && entry.lockedUntil <= now()) state.delete(key); // lock expired: start afresh
      return { allowed: true };
    },
    async recordFailure(key) {
      const entry = state.get(key) ?? { failures: 0, lockedUntil: 0 };
      entry.failures += 1;
      if (entry.failures >= options.maxAttempts) entry.lockedUntil = now() + options.lockoutMs;
      state.set(key, entry);
    },
    async reset(key) {
      state.delete(key);
    },
  };
}
