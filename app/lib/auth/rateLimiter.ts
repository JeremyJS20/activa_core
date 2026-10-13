interface AttemptRecord {
  attempts: number;
  blockedUntil: number | null;
}

export class InMemoryRateLimiter {
  private store: Map<string, AttemptRecord> = new Map();
  private maxAttempts: number;
  private windowMs: number;
  private blockDurationMs: number;

  constructor(maxAttempts = 5, windowMs = 15 * 60 * 1000, blockDurationMs = 15 * 60 * 1000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.blockDurationMs = blockDurationMs;
  }

  public isBlocked(key: string): { blocked: boolean; remainingSeconds: number } {
    const record = this.store.get(key);
    if (!record) {
      return { blocked: false, remainingSeconds: 0 };
    }

    const now = Date.now();
    if (record.blockedUntil && record.blockedUntil > now) {
      const remainingSeconds = Math.ceil((record.blockedUntil - now) / 1000);
      return { blocked: true, remainingSeconds };
    }

    if (record.blockedUntil && record.blockedUntil <= now) {
      this.store.delete(key);
      return { blocked: false, remainingSeconds: 0 };
    }

    return { blocked: false, remainingSeconds: 0 };
  }

  public recordFailedAttempt(key: string): { blocked: boolean; attemptsLeft: number; remainingSeconds: number } {
    const now = Date.now();
    let record = this.store.get(key);

    if (!record) {
      record = { attempts: 1, blockedUntil: null };
      this.store.set(key, record);
      return { blocked: false, attemptsLeft: this.maxAttempts - 1, remainingSeconds: 0 };
    }

    record.attempts += 1;

    if (record.attempts >= this.maxAttempts) {
      record.blockedUntil = now + this.blockDurationMs;
      const remainingSeconds = Math.ceil(this.blockDurationMs / 1000);
      return { blocked: true, attemptsLeft: 0, remainingSeconds };
    }

    return { blocked: false, attemptsLeft: this.maxAttempts - record.attempts, remainingSeconds: 0 };
  }


  public reset(key: string): void {
    this.store.delete(key);
  }
}

export const authRateLimiter = new InMemoryRateLimiter(5, 15 * 60 * 1000, 15 * 60 * 1000);
export default authRateLimiter;
