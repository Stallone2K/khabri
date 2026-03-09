interface RateLimitEntry {
  timestamps: number[];
  lifetimeCount: number;
  lastSyncedCount: number;
}

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

/**
 * Check rate limit for a given key hash.
 * Uses an in-memory sliding window — safe for single-VM PM2 setups.
 */
export function checkRateLimit(
  keyHash: string,
  limit: number,
  windowMs: number = 60_000,
): {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  retryAfterSeconds: number | null;
} {
  const now = Date.now();

  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    cleanupStaleEntries(windowMs);
    lastCleanup = now;
  }

  let entry = store.get(keyHash);
  if (!entry) {
    entry = { timestamps: [], lifetimeCount: 0, lastSyncedCount: 0 };
    store.set(keyHash, entry);
  }

  // Remove timestamps outside the sliding window
  const windowStart = now - windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= limit) {
    const oldestInWindow = entry.timestamps[0];
    const resetMs = oldestInWindow + windowMs;
    const retryAfterSeconds = Math.ceil((resetMs - now) / 1000);
    return { allowed: false, remaining: 0, resetMs, retryAfterSeconds };
  }

  entry.timestamps.push(now);
  entry.lifetimeCount++;

  return {
    allowed: true,
    remaining: limit - entry.timestamps.length,
    resetMs: now + windowMs,
    retryAfterSeconds: null,
  };
}

/**
 * Get the number of unsynchronized requests for a key (for DB sync).
 */
export function getUnsyncedCount(keyHash: string): number {
  const entry = store.get(keyHash);
  if (!entry) return 0;
  return entry.lifetimeCount - entry.lastSyncedCount;
}

/**
 * Mark the current count as synced (after DB update).
 */
export function markSynced(keyHash: string): void {
  const entry = store.get(keyHash);
  if (entry) {
    entry.lastSyncedCount = entry.lifetimeCount;
  }
}

function cleanupStaleEntries(windowMs: number): void {
  const threshold = Date.now() - windowMs * 2;
  for (const [key, entry] of store) {
    const latest = entry.timestamps[entry.timestamps.length - 1] || 0;
    if (latest < threshold) {
      store.delete(key);
    }
  }
}
