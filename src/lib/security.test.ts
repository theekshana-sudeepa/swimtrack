import { describe, it, expect, beforeEach } from "vitest";
import { timingSafeMatch, sanitizeString, sanitizeEmail, sanitizePhone } from "./security";
import { SlidingWindowRateLimiter } from "./rate-limiter";

describe("Security Utilities", () => {
  describe("timingSafeMatch", () => {
    it("returns true for matching strings regardless of length", () => {
      expect(timingSafeMatch("secret_token_123", "secret_token_123")).toBe(true);
      expect(timingSafeMatch("swimtrack2026", "swimtrack2026")).toBe(true);
      expect(timingSafeMatch("", "")).toBe(true);
    });

    it("returns false for mismatched strings without leaking timing", () => {
      expect(timingSafeMatch("secret_token_123", "secret_token_124")).toBe(false);
      expect(timingSafeMatch("short", "much_longer_string_here")).toBe(false);
      expect(timingSafeMatch("abc", "")).toBe(false);
    });
  });

  describe("sanitizeString", () => {
    it("strips script and iframe tags and content", () => {
      const malicious = '<script>alert("hacked")</script>Kasun Perera';
      expect(sanitizeString(malicious)).toBe("Kasun Perera");

      const iframe = '<iframe src="https://evil.com"></iframe>Sharky';
      expect(sanitizeString(iframe)).toBe("Sharky");
    });

    it("strips dangerous HTML tags and javascript: protocols", () => {
      const input = '<a href="javascript:alert(1)">Click Me</a>';
      expect(sanitizeString(input)).toBe("Click Me");
    });

    it("strips null bytes and event handlers", () => {
      const input = '<img src=x onerror=alert(1) />\0Kasun';
      expect(sanitizeString(input)).toBe("Kasun");
    });

    it("respects max length", () => {
      const long = "A".repeat(150);
      expect(sanitizeString(long, 50).length).toBe(50);
    });
  });

  describe("sanitizeEmail", () => {
    it("accepts valid email and normalizes to lowercase", () => {
      expect(sanitizeEmail("Kasun.Perera@Example.COM")).toBe("kasun.perera@example.com");
      expect(sanitizeEmail("swimmer123@domain.org")).toBe("swimmer123@domain.org");
    });

    it("rejects emails with CRLF injection characters", () => {
      expect(sanitizeEmail("test@example.com\r\nBcc: victim@example.com")).toBeNull();
      expect(sanitizeEmail("test@example.com\nEvil: true")).toBeNull();
    });

    it("rejects invalid emails", () => {
      expect(sanitizeEmail("not-an-email")).toBeNull();
      expect(sanitizeEmail("@no-user.com")).toBeNull();
      expect(sanitizeEmail("")).toBeNull();
    });
  });

  describe("sanitizePhone", () => {
    it("accepts valid phone numbers with +, spaces, and dashes", () => {
      expect(sanitizePhone("+94 77 123 4567")).toBe("+94 77 123 4567");
      expect(sanitizePhone("(011) 234-5678")).toBe("(011) 234-5678");
    });

    it("strips invalid characters", () => {
      expect(sanitizePhone("+94 77 123 4567<script>")).toBe("+94 77 123 4567");
    });

    it("rejects too short or too long strings", () => {
      expect(sanitizePhone("123")).toBeNull();
      expect(sanitizePhone("A".repeat(50))).toBeNull();
    });
  });

  describe("SlidingWindowRateLimiter", () => {
    let limiter: SlidingWindowRateLimiter;

    beforeEach(() => {
      limiter = new SlidingWindowRateLimiter({
        windowMs: 1000,
        maxAttempts: 3,
        lockoutMs: 2000,
      });
    });

    it("allows attempts under the max threshold", () => {
      expect(limiter.check("ip-1").allowed).toBe(true);
      limiter.recordFailure("ip-1");
      expect(limiter.check("ip-1").allowed).toBe(true);
      limiter.recordFailure("ip-1");
      expect(limiter.check("ip-1").allowed).toBe(true);
    });

    it("locks out when maxAttempts is reached", () => {
      limiter.recordFailure("ip-2");
      limiter.recordFailure("ip-2");
      limiter.recordFailure("ip-2");

      const check = limiter.check("ip-2");
      expect(check.allowed).toBe(false);
      expect(check.retryAfterSeconds).toBeGreaterThan(0);
    });

    it("resets on success", () => {
      limiter.recordFailure("ip-3");
      limiter.recordFailure("ip-3");
      limiter.reset("ip-3");
      expect(limiter.check("ip-3").remainingAttempts).toBe(3);
    });
  });
});
