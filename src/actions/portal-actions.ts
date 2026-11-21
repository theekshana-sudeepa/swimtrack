"use server";

import { revalidatePath } from "next/cache";
import { headers, cookies } from "next/headers";
import { DataStore } from "@/lib/data-store";
import { SupabaseDB } from "@/lib/supabase-db";
import {
  sanitizeString,
  hashSwimmerPin,
  verifySwimmerPinSecure,
  extractClientIp,
  timingSafeMatch,
} from "@/lib/security";
import {
  chalkboardRateLimiter,
  swimmerPinRateLimiter,
  swimmerPinGlobalRateLimiter,
  checkinAttemptRateLimiter,
  checkinChallengeRateLimiter,
  excuseRateLimiter,
} from "@/lib/rate-limiter";
import { getAdminSession, SWIMMER_COOKIE_NAME } from "@/lib/auth";
import { validateGeofenceCheckin } from "@/lib/geo-fence";
import {
  isSessionUpcomingOrActive,
  getMinutesUntilSessionStart,
} from "@/lib/attendance-calculator";
import {
  issueCheckinChallenge,
  verifyCheckinChallenge,
  consumeCheckinChallenge,
  attendanceStateStamp,
  DEVICE_CHECKIN_COOKIE_NAME,
  DEVICE_CHECKIN_TTL_MS,
  createDeviceCheckinToken,
  getDeviceBoundSwimmer,
} from "@/lib/checkin-challenge";
import { ensureStrongSwimmerToken } from "@/lib/swimmer-token-service";
import { sendCoachExcuseNotice } from "@/lib/resend-service";
import { rankSquadLeaderboard, computeCheckinImpact } from "@/lib/squad-ranks";
import type { Swimmer, SwimSession } from "@/types/database";

/** Reuse a recent full snapshot on swimmer paths instead of reloading every table per tap. */
const SWIMMER_SYNC_MAX_AGE_MS = 30_000;

type AuthResult =
  | { ok: true; swimmer: Swimmer }
  | { ok: false; error: string; needsLogin?: boolean };

/**
 * Authenticates a swimmer for any state-changing action. Requires BOTH:
 *  1. a valid, unguessable pass token, and
 *  2. the PIN-login session cookie for that same swimmer.
 * A pass link alone (forwarded email, shared screenshot) can no longer act on a swimmer's behalf,
 * so a friend cannot check in / excuse / post as someone else without their PIN.
 */
async function authenticateSwimmer(token: string): Promise<AuthResult> {
  const swimmer = DataStore.getSwimmerByToken(token);
  if (!swimmer || swimmer.status !== "active") {
    return { ok: false, error: "Invalid swimmer pass token." };
  }

  let cookieToken: string | undefined;
  try {
    cookieToken = (await cookies()).get(SWIMMER_COOKIE_NAME)?.value;
  } catch {
    cookieToken = undefined;
  }
  if (!cookieToken || !timingSafeMatch(cookieToken, token.trim())) {
    return {
      ok: false,
      needsLogin: true,
      error: "Please sign in with your PIN to continue.",
    };
  }

  return { ok: true, swimmer };
}

/** Shared session guards for swimmer actions. Returns an error string or null. */
function sessionBlockedReason(session: SwimSession): string | null {
  if (session.status === "cancelled") return "This swimming practice has been cancelled.";
  if (session.is_finalized) {
    return "Attendance for this session has already been finalized by the coach.";
  }
  return null;
}

/**
 * Swimmer self-reported excuse ("Can't make it") or clearing it again.
 *
 * IMPORTANT: this action can never mark a swimmer present/late. Presence is granted
 * only by the geofenced check-in (selfCheckInWithGeofenceAction) or by the coach.
 */
export async function submitExcuseAction(
  token: string,
  sessionId: string,
  action: "declare" | "clear",
  reason?: string
) {
  await DataStore.syncFromSupabase({ maxAgeMs: SWIMMER_SYNC_MAX_AGE_MS });

  const auth = await authenticateSwimmer(token);
  if (!auth.ok) return { success: false, error: auth.error, needsLogin: auth.needsLogin };
  const swimmer = auth.swimmer;

  const rate = excuseRateLimiter.check(`excuse_${swimmer.id}`);
  if (!rate.allowed) {
    return {
      success: false,
      error: `Too many attempts. Please wait ${rate.retryAfterSeconds} seconds.`,
    };
  }
  excuseRateLimiter.recordFailure(`excuse_${swimmer.id}`);

  // Current session + own attendance row straight from the database
  if (!(await SupabaseDB.refreshSessionAndAttendance(sessionId, swimmer.id))) {
    return { success: false, error: "Could not verify the session right now. Please try again." };
  }

  const session = DataStore.getSessionById(sessionId);
  if (!session) {
    return { success: false, error: "Swimming session not found." };
  }
  const blocked = sessionBlockedReason(session);
  if (blocked) return { success: false, error: blocked };
  if (!isSessionUpcomingOrActive(session)) {
    return {
      success: false,
      error: "This practice is over, so attendance can no longer be changed here. Contact the coach.",
    };
  }

  // Excuses close X minutes before start (coach-configurable) so the coach can plan the lane
  if (action === "declare") {
    const { excuseCutoffMinutes } = DataStore.getAttendancePolicy();
    if (getMinutesUntilSessionStart(session) < excuseCutoffMinutes) {
      return {
        success: false,
        error: `Excuses close ${excuseCutoffMinutes} minutes before practice. Please message the coach directly.`,
      };
    }
  }

  const cleanReason = reason ? sanitizeString(reason, 200) : undefined;
  const result = DataStore.submitSwimmerExcuse(swimmer.id, sessionId, action, cleanReason);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Persist to Supabase (with actor so the audit trail names the swimmer)
  const persisted = await SupabaseDB.upsertAttendance(
    result.record,
    swimmer.id,
    result.changeReason,
    result.oldStatus
  );
  if (!persisted) {
    return { success: false, error: "Could not save your change. Please try again." };
  }

  // Tell the coach (never blocks or fails the swimmer's action)
  try {
    await sendCoachExcuseNotice({ swimmer, session, action, reason: cleanReason });
  } catch (err) {
    console.warn("[submitExcuseAction] Coach notice failed:", err);
  }

  revalidatePath(`/portal/${token}`);
  revalidatePath("/attendance");
  revalidatePath("/dashboard");

  return { success: true, record: result.record };
}

/**
 * Posts a message/banter on the Squad Chalkboard.
 * Requires the swimmer's PIN-login session.
 */
export async function postChalkboardMessageAction(token: string, content: string) {
  await DataStore.syncFromSupabase({ maxAgeMs: SWIMMER_SYNC_MAX_AGE_MS });

  const auth = await authenticateSwimmer(token);
  if (!auth.ok) return { success: false, error: auth.error, needsLogin: auth.needsLogin };
  const swimmer = auth.swimmer;

  // Rate limiting against spamming the squad chalkboard
  const rateCheck = chalkboardRateLimiter.check(`chalk_${swimmer.id}`);
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: `Posting too quickly. Please wait ${rateCheck.retryAfterSeconds} seconds before posting again.`,
    };
  }

  const cleanContent = sanitizeString(content, 280);
  if (!cleanContent || cleanContent.length < 2) {
    return { success: false, error: "Message must be at least 2 characters." };
  }

  const authorName = swimmer.nickname
    ? `${swimmer.full_name} ("${swimmer.nickname}")`
    : swimmer.full_name;

  const msg = DataStore.postSquadMessage({
    author_name: authorName,
    content: cleanContent,
    author_swimmer_id: swimmer.id,
    is_admin: false,
  });

  await SupabaseDB.insertSquadMessage(msg);
  chalkboardRateLimiter.recordFailure(`chalk_${swimmer.id}`);

  revalidatePath(`/portal/${token}`);

  return { success: true, message: msg };
}

/**
 * Deletes a Chalkboard message (swimmers can delete their own; admins can delete any).
 */
export async function deleteChalkboardMessageAction(token: string, messageId: string) {
  await DataStore.syncFromSupabase({ maxAgeMs: SWIMMER_SYNC_MAX_AGE_MS });

  const admin = await getAdminSession();
  let actorSwimmerId: string | null = null;
  if (!admin) {
    const auth = await authenticateSwimmer(token);
    if (!auth.ok) return { success: false, error: auth.error, needsLogin: auth.needsLogin };
    actorSwimmerId = auth.swimmer.id;
  }

  const existing = DataStore.getSquadMessages().find((m) => m.id === messageId);
  if (!existing) {
    return { success: false, error: "Message not found." };
  }

  if (!admin && existing.author_swimmer_id !== actorSwimmerId) {
    return { success: false, error: "You can only delete your own chalkboard posts." };
  }

  DataStore.deleteSquadMessage(messageId);
  await SupabaseDB.deleteSquadMessage(messageId);

  if (token) revalidatePath(`/portal/${token}`);
  return { success: true };
}

/** In-flight guard so a double-tap / parallel request cannot run two check-ins at once. */
const checkInsInFlight = new Set<string>();

/**
 * Step 1 of a check-in: the swimmer asks the server for a short-lived, single-use challenge.
 * Requires the swimmer's PIN-login session.
 */
export async function issueCheckinChallengeAction(token: string, sessionId: string) {
  await DataStore.syncFromSupabase({ maxAgeMs: SWIMMER_SYNC_MAX_AGE_MS });

  const auth = await authenticateSwimmer(token);
  if (!auth.ok) {
    return { success: false as const, error: auth.error, needsLogin: auth.needsLogin };
  }
  const swimmer = auth.swimmer;

  const rate = checkinChallengeRateLimiter.check(`chal_${swimmer.id}`);
  if (!rate.allowed) {
    return {
      success: false as const,
      error: `Too many attempts. Please wait ${rate.retryAfterSeconds} seconds.`,
    };
  }
  checkinChallengeRateLimiter.recordFailure(`chal_${swimmer.id}`);

  if (!(await SupabaseDB.refreshSessionAndAttendance(sessionId, swimmer.id))) {
    return {
      success: false as const,
      error: "Could not verify the session right now. Please try again.",
    };
  }

  const session = DataStore.getSessionById(sessionId);
  if (!session) {
    return { success: false as const, error: "Swimming practice session not found." };
  }
  const blocked = sessionBlockedReason(session);
  if (blocked) return { success: false as const, error: blocked };

  // Anti-buddy-punching: reject early if this device already checked in a different swimmer for this session
  try {
    const devCookie = (await cookies()).get(DEVICE_CHECKIN_COOKIE_NAME)?.value;
    const boundSwimmer = getDeviceBoundSwimmer(devCookie, sessionId);
    if (boundSwimmer && boundSwimmer !== swimmer.id) {
      return {
        success: false as const,
        error:
          "This phone was already used to check in another swimmer for this practice. Ask the coach to mark your attendance.",
      };
    }
  } catch {
    // cookies() fallback
  }

  const row = DataStore.getSessionAttendance(sessionId).find((a) => a.swimmer_id === swimmer.id);
  return {
    success: true as const,
    challenge: issueCheckinChallenge(swimmer.id, sessionId, attendanceStateStamp(row)),
    requiresPin: DataStore.hasSwimmerPin(swimmer.id),
  };
}

/**
 * Step 2: Autonomous Swimmer Self-Check-in via Geofencing.
 * Validates the challenge, 4-digit PIN (when configured), anti-buddy-punching device lock,
 * GPS coordinates, accuracy, freshness and Colombo time window on the server.
 * The client is never trusted: there is no bypass flag, and the position age is
 * measured relative to the server clock (so phones with a wrong clock still work).
 */
export async function selfCheckInWithGeofenceAction(
  token: string,
  sessionId: string,
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    /** How old the GPS reading is on the device, in ms (Date.now() - position.timestamp). */
    positionAgeMs: number;
  },
  challenge: string,
  pin?: string
) {
  const lockKey = `${token}:${sessionId}`;
  if (checkInsInFlight.has(lockKey)) {
    return { success: false, error: "Your check-in is already being processed." };
  }
  checkInsInFlight.add(lockKey);

  try {
    await DataStore.syncFromSupabase({ maxAgeMs: SWIMMER_SYNC_MAX_AGE_MS });

    const auth = await authenticateSwimmer(token);
    if (!auth.ok) return { success: false, error: auth.error, needsLogin: auth.needsLogin };
    const swimmer = auth.swimmer;

    const rateKey = `checkin_${swimmer.id}`;
    const rate = checkinAttemptRateLimiter.check(rateKey);
    if (!rate.allowed) {
      return {
        success: false,
        error: `Too many check-in attempts. Please wait ${rate.retryAfterSeconds} seconds.`,
      };
    }
    checkinAttemptRateLimiter.recordFailure(rateKey);

    // Decide on CURRENT data: session (finalized? cancelled?) + own attendance row
    if (!(await SupabaseDB.refreshSessionAndAttendance(sessionId, swimmer.id))) {
      return { success: false, error: "Could not verify the session right now. Please try again." };
    }

    const session = DataStore.getSessionById(sessionId);
    if (!session) {
      return { success: false, error: "Swimming practice session not found." };
    }
    const blocked = sessionBlockedReason(session);
    if (blocked) return { success: false, error: blocked };

    // Anti-buddy-punching: 1 phone = 1 swimmer per practice session
    try {
      const devCookie = (await cookies()).get(DEVICE_CHECKIN_COOKIE_NAME)?.value;
      const boundSwimmer = getDeviceBoundSwimmer(devCookie, sessionId);
      if (boundSwimmer && boundSwimmer !== swimmer.id) {
        return {
          success: false,
          error:
            "This phone was already used to check in another swimmer for this practice. Ask the coach to mark your attendance.",
        };
      }
    } catch {
      // cookies() fallback
    }

    // Buddy check-in protection: require the swimmer's personal 4-digit PIN at check-in time
    const storedPinHash = DataStore.getSwimmerPinHash(swimmer.id);
    if (storedPinHash) {
      const globalPinKey = `pin_global_${swimmer.id}`;
      const globalPinCheck = swimmerPinGlobalRateLimiter.check(globalPinKey);
      if (!globalPinCheck.allowed) {
        return {
          success: false,
          error: `Too many failed PIN attempts. Try again in ${Math.ceil(globalPinCheck.retryAfterSeconds / 60)} minutes.`,
        };
      }
      const cleanPin = (pin || "").trim();
      if (!cleanPin) {
        return {
          success: false,
          needsPin: true,
          error: "Please enter your 4-digit PIN to confirm your check-in.",
        };
      }
      if (!verifySwimmerPinSecure(swimmer.id, cleanPin, storedPinHash)) {
        swimmerPinGlobalRateLimiter.recordFailure(globalPinKey);
        return {
          success: false,
          needsPin: true,
          error: "Incorrect 4-digit PIN. Please try again.",
        };
      }
      swimmerPinGlobalRateLimiter.reset(globalPinKey);
    }

    const currentRow = DataStore.getSessionAttendance(sessionId).find(
      (a) => a.swimmer_id === swimmer.id
    );

    const challengeCheck = verifyCheckinChallenge(
      challenge,
      swimmer.id,
      sessionId,
      attendanceStateStamp(currentRow)
    );
    if (!challengeCheck.ok) {
      return { success: false, error: challengeCheck.error };
    }

    const policy = DataStore.getAttendancePolicy();
    const savedVenues = DataStore.getSavedVenues();
    const positionAgeMs = Number(coords?.positionAgeMs);
    const validation = validateGeofenceCheckin({
      userLat: Number(coords?.latitude),
      userLng: Number(coords?.longitude),
      accuracy: Number(coords?.accuracy),
      clientTimestamp: Number.isFinite(positionAgeMs) ? Date.now() - Math.max(0, positionAgeMs) : NaN,
      session,
      lateThresholdMinutes: policy.lateThresholdMinutes,
      customVenues: savedVenues,
    });

    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error || "Geofence check-in validation failed.",
        distanceMeters: validation.distanceMeters,
        radiusMeters: validation.radiusMeters,
      };
    }

    // Log client IP for anti-proxy audit trail
    let clientIp = "127.0.0.1";
    try {
      const reqHeaders = await headers();
      clientIp = reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    } catch {
      // headers() graceful fallback
    }

    const auditReason = `${validation.reason} [IP: ${clientIp}]`;

    // Snapshot squad leaderboard BEFORE check-in so we can animate exact point gains & rank overtakes
    const beforeRanked = rankSquadLeaderboard(DataStore.getSwimmers({ status: "active" }));
    const alreadyCheckedInCount = DataStore.getSessionAttendance(sessionId).filter(
      (a) => a.swimmer_id !== swimmer.id && (a.status === "present" || a.status === "late")
    ).length;
    const isFirstOnDeck = alreadyCheckedInCount === 0;

    // ---- Atomic section: no `await` between the duplicate check and the write ----
    const previous = DataStore.getSessionAttendance(sessionId).find(
      (a) => a.swimmer_id === swimmer.id
    );
    if (previous && (previous.status === "present" || previous.status === "late")) {
      return {
        success: false,
        error: `You have already checked in as ${previous.status.toUpperCase()}!`,
      };
    }
    if (!consumeCheckinChallenge(challengeCheck.nonce)) {
      return { success: false, error: "This check-in request was already used. Please try again." };
    }
    const previousSnapshot = previous ? { ...previous, swimmer: undefined } : null;

    const result = DataStore.checkInSwimmerWithGeofence(
      swimmer.id,
      sessionId,
      validation.status,
      validation.distanceMeters,
      coords.accuracy,
      auditReason,
      validation.note
    );
    // ------------------------------------------------------------------------------

    const persisted = await SupabaseDB.upsertAttendance(
      result.record,
      swimmer.id,
      auditReason,
      result.auditLog.old_status
    );
    if (!persisted) {
      // Never tell a swimmer they are checked in if the database does not have it
      DataStore.revertAttendanceChange(sessionId, swimmer.id, previousSnapshot, result.auditLog.id);
      return {
        success: false,
        error: "We could not save your check-in. Please check your connection and try again.",
      };
    }

    // Compute live AFTER leaderboard & check-in celebration payload (strictly privacy-safe)
    const afterRanked = rankSquadLeaderboard(DataStore.getSwimmers({ status: "active" }));
    const impact = computeCheckinImpact({
      swimmerId: swimmer.id,
      beforeRanked,
      afterRanked,
      sessionTitle: session.title,
      distanceMeters: validation.distanceMeters,
      isFirstOnDeck,
      status: validation.status,
      minutesLate: validation.minutesLate,
      isGps: true,
    });

    checkinAttemptRateLimiter.reset(rateKey);

    // Bind this browser/phone to this swimmer for this practice so it cannot check in a second swimmer
    try {
      const cookieStore = await cookies();
      cookieStore.set(
        DEVICE_CHECKIN_COOKIE_NAME,
        createDeviceCheckinToken(sessionId, swimmer.id),
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: Math.floor(DEVICE_CHECKIN_TTL_MS / 1000),
        }
      );
    } catch {
      // cookies() fallback in non-request contexts
    }

    revalidatePath(`/portal/${token}`);
    revalidatePath("/attendance");
    revalidatePath(`/sessions/${sessionId}`);
    revalidatePath("/dashboard");

    return {
      success: true,
      // Never ship the full swimmer object (it carries the pass token) back to the browser
      record: { ...result.record, swimmer: undefined },
      status: validation.status,
      isLate: validation.isLate,
      minutesLate: validation.minutesLate,
      distanceMeters: validation.distanceMeters,
      radiusMeters: validation.radiusMeters,
      impact,
    };
  } finally {
    checkInsInFlight.delete(lockKey);
  }
}

/**
 * Returns the list of active squad members for the Swimmer Pass selection screen.
 * For privacy and security, pass tokens are strictly excluded.
 */
export async function getPortalSquadListAction() {
  await DataStore.syncFromSupabase();
  const swimmers = DataStore.getSwimmers({ status: "active" });
  return swimmers.map((s) => ({
    id: s.id,
    full_name: s.full_name,
    nickname: s.nickname || null,
    avatar_color: s.avatar_color || "ocean",
    hasPin: DataStore.hasSwimmerPin(s.id),
  }));
}

/**
 * Checks if the current visitor already has a valid swimmer session cookie.
 */
export async function getRememberedSwimmerAction() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SWIMMER_COOKIE_NAME)?.value;
    if (!token) return { loggedIn: false };

    await DataStore.syncFromSupabase();
    const swimmer = DataStore.getSwimmerByToken(token);
    if (!swimmer || swimmer.status !== "active") {
      return { loggedIn: false };
    }

    return {
      loggedIn: true,
      swimmer: {
        id: swimmer.id,
        full_name: swimmer.full_name,
        nickname: swimmer.nickname || null,
        avatar_color: swimmer.avatar_color || "ocean",
        token,
      },
    };
  } catch {
    return { loggedIn: false };
  }
}

/**
 * Verifies a swimmer's 4-digit PIN, with anti-brute-force rate limiting.
 * On success, sets a persistent session cookie and returns their personal pass token.
 */
export async function loginSwimmerWithPinAction(swimmerId: string, pin: string) {
  await DataStore.syncFromSupabase();
  const swimmer = DataStore.getSwimmerById(swimmerId);
  if (!swimmer || swimmer.status !== "active") {
    return { success: false, error: "Active swimmer profile not found." };
  }

  // Rate limiting per swimmer + client IP
  let clientIp = "127.0.0.1";
  try {
    const reqHeaders = await headers();
    clientIp = extractClientIp(reqHeaders);
  } catch {
    // fallback
  }

  const rateLimitKey = `pin_${swimmerId}_${clientIp}`;
  const globalKey = `pin_global_${swimmerId}`;
  const rateCheck = swimmerPinRateLimiter.check(rateLimitKey);
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: `Too many failed PIN attempts. Locked out for ${rateCheck.retryAfterSeconds} seconds.`,
    };
  }
  // A 4-digit PIN has only 10,000 combinations: also cap failures per swimmer across ALL IPs
  const globalCheck = swimmerPinGlobalRateLimiter.check(globalKey);
  if (!globalCheck.allowed) {
    return {
      success: false,
      error: `Too many failed attempts on this profile. Try again in ${Math.ceil(globalCheck.retryAfterSeconds / 60)} minutes.`,
    };
  }

  const storedHash = DataStore.getSwimmerPinHash(swimmerId);
  if (!storedHash) {
    return {
      success: false,
      needsSetup: true,
      error: "No PIN has been configured for this profile yet. Please create your PIN.",
    };
  }

  const cleanPin = (pin || "").trim();
  const isValid = verifySwimmerPinSecure(swimmerId, cleanPin, storedHash);

  if (!isValid) {
    swimmerPinRateLimiter.recordFailure(rateLimitKey);
    swimmerPinGlobalRateLimiter.recordFailure(globalKey);
    const checkAfter = swimmerPinRateLimiter.check(rateLimitKey);
    const remaining = checkAfter.remainingAttempts;
    return {
      success: false,
      error:
        remaining > 0
          ? `Incorrect PIN. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
          : `Incorrect PIN. Profile locked for ${checkAfter.retryAfterSeconds} seconds.`,
    };
  }

  // Success: reset rate limit
  swimmerPinRateLimiter.reset(rateLimitKey);
  swimmerPinGlobalRateLimiter.reset(globalKey);

  const token = await ensureStrongSwimmerToken(swimmer.id);
  if (!token) {
    return { success: false, error: "Could not create your secure pass. Please try again." };
  }

  const cookieStore = await cookies();
  cookieStore.set(SWIMMER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90, // 90 days
  });

  return {
    success: true,
    token,
    swimmerName: swimmer.nickname || swimmer.full_name,
  };
}

/**
 * Creates a personal 4-digit PIN for first-time swimmer setup.
 */
export async function setupSwimmerPinAction(
  swimmerId: string,
  pin: string,
  confirmPin: string
) {
  await DataStore.syncFromSupabase();
  const swimmer = DataStore.getSwimmerById(swimmerId);
  if (!swimmer || swimmer.status !== "active") {
    return { success: false, error: "Active swimmer profile not found." };
  }

  if (DataStore.hasSwimmerPin(swimmerId)) {
    return {
      success: false,
      error:
        "A security PIN is already configured for this swimmer. Please enter your PIN or ask the coach to reset it.",
    };
  }

  const cleanPin = (pin || "").trim();
  const cleanConfirm = (confirmPin || "").trim();

  if (!/^\d{4}$/.test(cleanPin)) {
    return {
      success: false,
      error: "PIN must be exactly 4 numeric digits (e.g. 1234).",
    };
  }

  if (cleanPin !== cleanConfirm) {
    return {
      success: false,
      error: "The PINs you entered do not match. Please try again.",
    };
  }

  const hashed = hashSwimmerPin(swimmerId, cleanPin);
  DataStore.setSwimmerPin(swimmerId, hashed);

  // Sync to Supabase
  const pinsObj =
    (DataStore.getAppSettings()["swimmer_pins"]?.value as Record<string, unknown>) || {};
  await SupabaseDB.upsertAppSetting("swimmer_pins", pinsObj);

  const token = await ensureStrongSwimmerToken(swimmer.id);
  if (!token) {
    return { success: false, error: "Could not create your secure pass. Please try again." };
  }

  const cookieStore = await cookies();
  cookieStore.set(SWIMMER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });

  revalidatePath("/portal");
  revalidatePath(`/portal/${token}`);

  return {
    success: true,
    token,
    swimmerName: swimmer.nickname || swimmer.full_name,
  };
}

/**
 * Logs out the swimmer by clearing their session cookie.
 */
export async function logoutSwimmerAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SWIMMER_COOKIE_NAME);
  revalidatePath("/portal");
  return { success: true };
}

/**
 * Admin action to reset or manually set a swimmer's 4-digit security PIN.
 */
export async function adminResetSwimmerPinAction(swimmerId: string, newPin?: string) {
  const admin = await getAdminSession();
  if (!admin) {
    return { success: false, error: "Administrator authorization required." };
  }

  await DataStore.syncFromSupabase();
  const swimmer = DataStore.getSwimmerById(swimmerId);
  if (!swimmer) {
    return { success: false, error: "Swimmer not found." };
  }

  if (newPin && newPin.trim()) {
    const cleanPin = newPin.trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      return { success: false, error: "PIN must be exactly 4 numeric digits." };
    }
    const hashed = hashSwimmerPin(swimmerId, cleanPin);
    DataStore.setSwimmerPin(swimmerId, hashed);
  } else {
    // Clear PIN so swimmer can set it themselves
    DataStore.deleteSwimmerPin(swimmerId);
  }

  // Persist to Supabase
  const pinsObj =
    (DataStore.getAppSettings()["swimmer_pins"]?.value as Record<string, unknown>) || {};
  await SupabaseDB.upsertAppSetting("swimmer_pins", pinsObj);

  revalidatePath("/portal");
  revalidatePath(`/swimmers/${swimmerId}`);

  return {
    success: true,
    message: newPin?.trim()
      ? `Security PIN for ${swimmer.full_name} updated successfully.`
      : `Security PIN for ${swimmer.full_name} has been reset. They can set a new PIN on next login.`,
  };
}

