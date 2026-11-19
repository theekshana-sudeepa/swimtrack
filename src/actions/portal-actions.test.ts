import { describe, it, expect, beforeEach, vi } from "vitest";
import { DataStore } from "@/lib/data-store";
import { SWIMMER_COOKIE_NAME } from "@/lib/auth";
import {
  DEVICE_CHECKIN_COOKIE_NAME,
  _resetCheckinChallengesForTests,
} from "@/lib/checkin-challenge";
import { hashSwimmerPin } from "@/lib/security";
import {
  checkinAttemptRateLimiter,
  checkinChallengeRateLimiter,
  excuseRateLimiter,
  swimmerPinGlobalRateLimiter,
} from "@/lib/rate-limiter";

const cookieJar = new Map<string, string>();

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "203.0.113.10" })),
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value !== undefined ? { name, value } : undefined;
    },
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  })),
}));

import {
  issueCheckinChallengeAction,
  selfCheckInWithGeofenceAction,
  submitExcuseAction,
} from "./portal-actions";

describe("Portal Server Actions (End-to-End Security & Integrity)", () => {
  beforeEach(() => {
    cookieJar.clear();
    _resetCheckinChallengesForTests();
    DataStore.resetToDemo();
  });

  function createTodayActiveSession() {
    const todayColombo = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Colombo",
    }).format(new Date());
    return DataStore.createSession({
      title: "Live Poolside Session",
      date: todayColombo,
      start_time: "00:00:00",
      end_time: "23:59:00",
      location: "Royal College Aquatic Complex, Colombo",
    });
  }

  it("rejects check-in and excuse actions when the PIN-login session cookie is missing", async () => {
    const swimmer = DataStore.getSwimmers({ status: "active" })[0];
    const token = swimmer.reminder_preferences!.opt_out_token!;
    const session = createTodayActiveSession();

    // No SWIMMER_COOKIE_NAME in cookieJar -> link-only access is blocked
    const chal = await issueCheckinChallengeAction(token, session.id);
    expect(chal.success).toBe(false);
    expect((chal as { needsLogin?: boolean }).needsLogin).toBe(true);

    const exc = await submitExcuseAction(token, session.id, "declare", "Sick");
    expect(exc.success).toBe(false);
    expect((exc as { needsLogin?: boolean }).needsLogin).toBe(true);

    DataStore.deleteSession(session.id);
  });

  it("completes a GPS check-in with challenge + 4-digit PIN and blocks replay or buddy-punching on the same device", async () => {
    const [swimmerA, swimmerB] = DataStore.getSwimmers({ status: "active" });
    const tokenA = swimmerA.reminder_preferences!.opt_out_token!;
    const tokenB = swimmerB.reminder_preferences!.opt_out_token!;
    const session = createTodayActiveSession();

    // Configure a 4-digit PIN for Swimmer A
    DataStore.setSwimmerPin(swimmerA.id, hashSwimmerPin(swimmerA.id, "2468"));
    checkinAttemptRateLimiter.reset(`checkin_${swimmerA.id}`);
    checkinChallengeRateLimiter.reset(`chal_${swimmerA.id}`);
    swimmerPinGlobalRateLimiter.reset(`pin_global_${swimmerA.id}`);

    // Sign in Swimmer A on this device
    cookieJar.set(SWIMMER_COOKIE_NAME, tokenA);

    const chalRes = await issueCheckinChallengeAction(tokenA, session.id);
    expect(chalRes.success).toBe(true);
    if (!chalRes.success) return;
    expect(chalRes.requiresPin).toBe(true);

    // 1. Missing or wrong PIN is rejected without consuming the challenge
    const wrongPinRes = await selfCheckInWithGeofenceAction(
      tokenA,
      session.id,
      { latitude: 6.9056, longitude: 79.8614, accuracy: 10, positionAgeMs: 500 },
      chalRes.challenge,
      "0000"
    );
    expect(wrongPinRes.success).toBe(false);
    expect((wrongPinRes as { needsPin?: boolean }).needsPin).toBe(true);

    // 2. Correct PIN + inside 75m pool zone -> succeeds and binds the device cookie
    const okRes = await selfCheckInWithGeofenceAction(
      tokenA,
      session.id,
      { latitude: 6.9056, longitude: 79.8614, accuracy: 10, positionAgeMs: 500 },
      chalRes.challenge,
      "2468"
    );
    expect(okRes.success).toBe(true);
    expect(cookieJar.get(DEVICE_CHECKIN_COOKIE_NAME)).toBeTruthy();

    // 3. Replaying the same challenge is rejected
    const replayRes = await selfCheckInWithGeofenceAction(
      tokenA,
      session.id,
      { latitude: 6.9056, longitude: 79.8614, accuracy: 10, positionAgeMs: 500 },
      chalRes.challenge,
      "2468"
    );
    expect(replayRes.success).toBe(false);

    // 4. Buddy-punching: Swimmer B logs in on the SAME phone to check in for the same session -> blocked!
    cookieJar.set(SWIMMER_COOKIE_NAME, tokenB);
    const buddyChal = await issueCheckinChallengeAction(tokenB, session.id);
    expect(buddyChal.success).toBe(false);
    expect(buddyChal.error).toContain("already used to check in another swimmer");

    DataStore.deleteSwimmerPin(swimmerA.id);
    DataStore.deleteSession(session.id);
  });

  it("enforces the pre-session excuse cut-off window", async () => {
    const swimmer = DataStore.getSwimmers({ status: "active" })[0];
    const token = swimmer.reminder_preferences!.opt_out_token!;
    cookieJar.set(SWIMMER_COOKIE_NAME, token);
    excuseRateLimiter.reset(`excuse_${swimmer.id}`);

    // Session that already started today (0 minutes remaining < 60-minute default cut-off)
    const todaySession = createTodayActiveSession();
    const tooLate = await submitExcuseAction(token, todaySession.id, "declare", "Traffic");
    expect(tooLate.success).toBe(false);
    expect(tooLate.error).toContain("Excuses close");

    // Future session next year (> 60 minutes away) -> allowed
    const futureSession = DataStore.createSession({
      title: "Future Practice",
      date: "2099-12-15",
      start_time: "06:30:00",
      end_time: "08:00:00",
      location: "Royal College Aquatic Complex, Colombo",
    });
    const allowed = await submitExcuseAction(token, futureSession.id, "declare", "Family wedding");
    expect(allowed.success).toBe(true);

    DataStore.deleteSession(todaySession.id);
    DataStore.deleteSession(futureSession.id);
  });
});

