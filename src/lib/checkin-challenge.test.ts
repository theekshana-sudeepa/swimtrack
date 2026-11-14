import { describe, it, expect, beforeEach } from "vitest";
import {
  issueCheckinChallenge,
  verifyCheckinChallenge,
  consumeCheckinChallenge,
  CHECKIN_CHALLENGE_TTL_MS,
  attendanceStateStamp,
  createDeviceCheckinToken,
  getDeviceBoundSwimmer,
  DEVICE_CHECKIN_TTL_MS,
  _resetCheckinChallengesForTests,
} from "./checkin-challenge";

describe("check-in challenge", () => {
  beforeEach(() => _resetCheckinChallengesForTests());

  it("verifies a fresh challenge bound to the same swimmer and session", () => {
    const c = issueCheckinChallenge("sw1", "se1");
    expect(verifyCheckinChallenge(c, "sw1", "se1").ok).toBe(true);
  });

  it("rejects a different swimmer or session", () => {
    const c = issueCheckinChallenge("sw1", "se1");
    expect(verifyCheckinChallenge(c, "sw2", "se1").ok).toBe(false);
    expect(verifyCheckinChallenge(c, "sw1", "se2").ok).toBe(false);
  });

  it("rejects tampered, missing or malformed challenges", () => {
    const c = issueCheckinChallenge("sw1", "se1");
    expect(verifyCheckinChallenge(c.slice(0, -2) + "00", "sw1", "se1").ok).toBe(false);
    expect(verifyCheckinChallenge("", "sw1", "se1").ok).toBe(false);
    expect(verifyCheckinChallenge(undefined, "sw1", "se1").ok).toBe(false);
    expect(verifyCheckinChallenge("garbage", "sw1", "se1").ok).toBe(false);
  });

  it("expires after the TTL", () => {
    const t0 = 1_000_000;
    const c = issueCheckinChallenge("sw1", "se1", "", t0);
    expect(verifyCheckinChallenge(c, "sw1", "se1", "", t0 + CHECKIN_CHALLENGE_TTL_MS - 1).ok).toBe(true);
    expect(verifyCheckinChallenge(c, "sw1", "se1", "", t0 + CHECKIN_CHALLENGE_TTL_MS + 1).ok).toBe(false);
  });

  it("is invalidated once the attendance row changes (works across instances)", () => {
    const before = attendanceStateStamp({ status: "not_marked", updated_at: "t1" });
    const after = attendanceStateStamp({ status: "present", updated_at: "t2" });
    const c = issueCheckinChallenge("sw1", "se1", before);
    expect(verifyCheckinChallenge(c, "sw1", "se1", before).ok).toBe(true);
    expect(verifyCheckinChallenge(c, "sw1", "se1", after).ok).toBe(false);
  });

  it("is single use", () => {
    const c = issueCheckinChallenge("sw1", "se1");
    const v = verifyCheckinChallenge(c, "sw1", "se1");
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(consumeCheckinChallenge(v.nonce)).toBe(true);
      expect(consumeCheckinChallenge(v.nonce)).toBe(false);
    }
    expect(verifyCheckinChallenge(c, "sw1", "se1").ok).toBe(false);
  });

  it("binds a device to the first swimmer who checked in for a session (anti-buddy-punching)", () => {
    const t0 = 2_000_000;
    const tok = createDeviceCheckinToken("sess-1", "swimmer-a", t0);

    // Same session -> returns swimmer-a
    expect(getDeviceBoundSwimmer(tok, "sess-1", t0 + 1000)).toBe("swimmer-a");
    // Different session -> not bound
    expect(getDeviceBoundSwimmer(tok, "sess-2", t0 + 1000)).toBeNull();
    // Tampered token -> ignored
    expect(getDeviceBoundSwimmer(tok.slice(0, -2) + "ff", "sess-1", t0 + 1000)).toBeNull();
    // Expired after 18h -> ignored
    expect(getDeviceBoundSwimmer(tok, "sess-1", t0 + DEVICE_CHECKIN_TTL_MS + 1)).toBeNull();
  });
});
