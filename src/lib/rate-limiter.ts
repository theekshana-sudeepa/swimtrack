/**
 * In-memory sliding-window rate limiter for brute-force and abuse protection.
 * Works across serverless and long-running Node.js instances.
 */

interface RateLimitRecord {
  timestamps: number[];
  lockedUntil?: number;
}

export class SlidingWindowRateLimiter {
  private windowMs: number;
  private maxAttempts: number;
  private lockoutMs: number;
  private store: Map<string, RateLimitRecord>;

  constructor(options: {
    windowMs: number;
    maxAttempts: number;
    lockoutMs?: number;
  }) {
    this.windowMs = options.windowMs;
    this.maxAttempts = options.maxAttempts;
    this.lockoutMs = options.lockoutMs || options.windowMs;
    this.store = new Map();
  }

  /**
   * Checks if an action is permitted for the given key (e.g. IP or email).
   */
  check(key: string): { allowed: boolean; remainingAttempts: number; retryAfterSeconds: number } {
    const now = Date.now();
    const record = this.store.get(key) || { timestamps: [] };

    // Check if locked out
    if (record.lockedUntil && record.lockedUntil > now) {
      const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return { allowed: false, remainingAttempts: 0, retryAfterSeconds };
    }

    // Filter out timestamps outside sliding window
    const recent = record.timestamps.filter((ts) => now - ts < this.windowMs);
    record.timestamps = recent;

    if (recent.length >= this.maxAttempts) {
      // Lock out key
      record.lockedUntil = now + this.lockoutMs;
      this.store.set(key, record);
      const retryAfterSeconds = Math.ceil(this.lockoutMs / 1000);
      return { allowed: false, remainingAttempts: 0, retryAfterSeconds };
    }

    this.store.set(key, record);
    return {
      allowed: true,
      remainingAttempts: this.maxAttempts - recent.length,
      retryAfterSeconds: 0,
    };
  }

  /**
   * Records a failed attempt for the given key.
   */
  recordFailure(key: string): void {
    const now = Date.now();
    const record = this.store.get(key) || { timestamps: [] };
    record.timestamps.push(now);

    if (record.timestamps.length >= this.maxAttempts) {
      record.lockedUntil = now + this.lockoutMs;
    }

    this.store.set(key, record);
  }

  /**
   * Resets the rate limit record on successful action (e.g. successful login).
   */
  reset(key: string): void {
    this.store.delete(key);
  }
}

// Pre-configured rate limiters for specific critical flows
// Admin Login: Max 5 failed attempts per 15 minutes -> 15 min lockout
export const loginRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxAttempts: 5,
  lockoutMs: 15 * 60 * 1000,
});

// Public Swimmer Join: Max 10 submissions per 10 minutes
export const joinRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxAttempts: 10,
  lockoutMs: 10 * 60 * 1000,
});

// Chalkboard Banter: Max 6 posts per 2 minutes
export const chalkboardRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 2 * 60 * 1000,
  maxAttempts: 6,
  lockoutMs: 2 * 60 * 1000,
});

// Reminder Action: Max 20 manual bulk reminder dispatches per 5 minutes
export const reminderRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxAttempts: 20,
  lockoutMs: 5 * 60 * 1000,
});

// Swimmer PIN Entry: Max 5 failed attempts per 10 minutes -> 10 min lockout per IP or swimmer ID
export const swimmerPinRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxAttempts: 5,
  lockoutMs: 10 * 60 * 1000,
});

// Swimmer PIN brute force across rotating IPs: cap failures per swimmer regardless of IP
export const swimmerPinGlobalRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 30 * 60 * 1000,
  maxAttempts: 15,
  lockoutMs: 15 * 60 * 1000,
});

// GPS check-in attempts: Max 8 per 5 minutes per swimmer (stops scripted position probing)
export const checkinAttemptRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxAttempts: 8,
  lockoutMs: 5 * 60 * 1000,
});

// Check-in challenge requests: Max 12 per 5 minutes per swimmer
export const checkinChallengeRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxAttempts: 12,
  lockoutMs: 5 * 60 * 1000,
});

// Excuse submissions: Max 6 per 10 minutes per swimmer
export const excuseRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxAttempts: 6,
  lockoutMs: 10 * 60 * 1000,
});

// Squad memory photo uploads: Max 12 per 10 minutes per swimmer
export const memoryUploadRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxAttempts: 12,
  lockoutMs: 10 * 60 * 1000,
});

// Emoji reactions: Max 30 toggles per 2 minutes per swimmer
export const reactionRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 2 * 60 * 1000,
  maxAttempts: 30,
  lockoutMs: 2 * 60 * 1000,
});

// Bill split actions: Max 15 per 10 minutes per swimmer
export const expenseRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxAttempts: 15,
  lockoutMs: 10 * 60 * 1000,
});
