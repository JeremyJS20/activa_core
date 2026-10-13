import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryRateLimiter } from "@/lib/auth/rateLimiter";

describe("rateLimiter - Protección Anti Fuerza Bruta (Brute-Force Throttling)", () => {
  let limiter: InMemoryRateLimiter;
  const testKey = "user_test_bruteforce@unapec.edu.do";

  beforeEach(() => {
    limiter = new InMemoryRateLimiter(5, 1000, 2000); // 5 intentos, ventana 1s, bloqueo 2s
  });

  it("debe iniciar sin bloqueo para una clave nueva", () => {
    const status = limiter.isBlocked(testKey);
    expect(status.blocked).toBe(false);
    expect(status.remainingSeconds).toBe(0);
  });

  it("debe descontar los intentos restantes progresivamente en cada fallo", () => {
    const attempt1 = limiter.recordFailedAttempt(testKey);
    expect(attempt1.blocked).toBe(false);
    expect(attempt1.attemptsLeft).toBe(4);

    const attempt2 = limiter.recordFailedAttempt(testKey);
    expect(attempt2.blocked).toBe(false);
    expect(attempt2.attemptsLeft).toBe(3);

    const attempt3 = limiter.recordFailedAttempt(testKey);
    expect(attempt3.blocked).toBe(false);
    expect(attempt3.attemptsLeft).toBe(2);

    const attempt4 = limiter.recordFailedAttempt(testKey);
    expect(attempt4.blocked).toBe(false);
    expect(attempt4.attemptsLeft).toBe(1);
  });

  it("debe bloquear la cuenta al alcanzar exactamente el quinto (5) intento fallido", () => {
    for (let i = 0; i < 4; i++) {
      limiter.recordFailedAttempt(testKey);
    }

    const finalAttempt = limiter.recordFailedAttempt(testKey);
    expect(finalAttempt.blocked).toBe(true);
    expect(finalAttempt.attemptsLeft).toBe(0);
    expect(finalAttempt.remainingSeconds).toBeGreaterThan(0);

    const checkBlocked = limiter.isBlocked(testKey);
    expect(checkBlocked.blocked).toBe(true);
    expect(checkBlocked.remainingSeconds).toBeGreaterThan(0);
  });

  it("debe desbloquear inmediatamente la cuenta tras invocar reset()", () => {
    for (let i = 0; i < 5; i++) {
      limiter.recordFailedAttempt(testKey);
    }
    expect(limiter.isBlocked(testKey).blocked).toBe(true);

    limiter.reset(testKey);

    const checkAfterReset = limiter.isBlocked(testKey);
    expect(checkAfterReset.blocked).toBe(false);
    expect(checkAfterReset.remainingSeconds).toBe(0);
  });
});
