// Simple token-bucket rate limiter shared across the Node process.
// Not distributed — each Next.js instance keeps its own counters. For MentorIA
// (single escritorio container behind Traefik) this is sufficient protection
// against runaway client loops and accidental hammering.

type Bucket = {
  tokens: number;
  lastRefillMs: number;
};

const buckets = new Map<string, Bucket>();
let lastGcMs = 0;

function gc(nowMs: number) {
  // Clean buckets we haven't touched for > 10 min, at most every minute.
  if (nowMs - lastGcMs < 60_000) return;
  lastGcMs = nowMs;
  const cutoff = nowMs - 10 * 60_000;
  for (const [k, b] of buckets) {
    if (b.lastRefillMs < cutoff) buckets.delete(k);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

/**
 * Consume one token from the given bucket key.
 *
 * @param key         Unique per-actor (e.g. `chat:${userId}`).
 * @param capacity    Max tokens (burst size).
 * @param refillPerSec Tokens added per second.
 */
export function rateLimit(
  key: string,
  capacity: number,
  refillPerSec: number
): RateLimitResult {
  const now = Date.now();
  gc(now);

  let b = buckets.get(key);
  if (!b) {
    b = { tokens: capacity, lastRefillMs: now };
    buckets.set(key, b);
  } else {
    const elapsed = (now - b.lastRefillMs) / 1000;
    const refill = elapsed * refillPerSec;
    if (refill > 0) {
      b.tokens = Math.min(capacity, b.tokens + refill);
      b.lastRefillMs = now;
    }
  }

  if (b.tokens >= 1) {
    b.tokens -= 1;
    return {
      allowed: true,
      remaining: Math.floor(b.tokens),
      resetSeconds: Math.ceil((capacity - b.tokens) / refillPerSec),
    };
  }
  const needed = 1 - b.tokens;
  return {
    allowed: false,
    remaining: 0,
    resetSeconds: Math.ceil(needed / refillPerSec),
  };
}
