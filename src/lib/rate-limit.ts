const attempts = new Map<string, { count: number; lastAttempt: number }>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minute lockout

export function checkRateLimit(identifier: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const record = attempts.get(identifier);

  if (!record) {
    attempts.set(identifier, { count: 1, lastAttempt: now });
    return { allowed: true };
  }

  // Reset if window has passed
  if (now - record.lastAttempt > WINDOW_MS) {
    attempts.set(identifier, { count: 1, lastAttempt: now });
    return { allowed: true };
  }

  if (record.count >= MAX_ATTEMPTS) {
    const retryAfterMs = LOCKOUT_MS - (now - record.lastAttempt);
    if (retryAfterMs > 0) {
      return { allowed: false, retryAfterMs };
    }
    // Lockout expired
    attempts.set(identifier, { count: 1, lastAttempt: now });
    return { allowed: true };
  }

  record.count++;
  record.lastAttempt = now;
  return { allowed: true };
}

export function resetRateLimit(identifier: string) {
  attempts.delete(identifier);
}

// Clean up old entries periodically (prevent memory leak)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of attempts) {
    if (now - record.lastAttempt > WINDOW_MS * 2) {
      attempts.delete(key);
    }
  }
}, 60 * 1000);
