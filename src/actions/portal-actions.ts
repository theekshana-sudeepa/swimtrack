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
} from "@/lib/security";
import { chalkboardRateLimiter, swimmerPinRateLimiter } from "@/lib/rate-limiter";
import { getAdminSession, SWIMMER_COOKIE_NAME } from "@/lib/auth";
import { validateGeofenceCheckin, getSessionVenueCoordinates } from "@/lib/geo-fence";

/**
 * 1-Tap RSVP submission from the Swimmer Pass portal.
 * Token-authenticated (passwordless).
 */
export async function submitRsvpAction(
  token: string,
  sessionId: string,
  status: "attending" | "declined",
  reason?: string
) {
  const swimmer = DataStore.getSwimmerByToken(token);
  if (!swimmer) {
    return { success: false, error: "Invalid swimmer pass token." };
  }

  const session = DataStore.getSessionById(sessionId);
  if (!session) {
    return { success: false, error: "Swimming session not found." };
  }

  const cleanReason = reason ? sanitizeString(reason, 200) : undefined;

  const record = DataStore.submitSwimmerRsvp(
    swimmer.id,
    sessionId,
    status,
    cleanReason
  );

  // Persist directly to Supabase
  if (record) {
    await SupabaseDB.upsertAttendance(
      record,
      undefined,
      cleanReason ? `RSVP: ${status} (${cleanReason})` : `RSVP: ${status}`
    );
  }

  revalidatePath(`/portal/${token}`);
  revalidatePath("/attendance");
  revalidatePath("/dashboard");

  return { success: true, record };
}

/**
 * Posts a message/banter on the Squad Chalkboard.
 * Token-authenticated (passwordless).
 */
export async function postChalkboardMessageAction(token: string, content: string) {
  const swimmer = DataStore.getSwimmerByToken(token);
  if (!swimmer) {
    return { success: false, error: "Invalid swimmer pass token." };
  }

  // Rate limiting against spamming the squad chalkboard
  const rateCheck = chalkboardRateLimiter.check(`chalk_${token}`);
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

  chalkboardRateLimiter.recordFailure(`chalk_${token}`);

  revalidatePath(`/portal/${token}`);

  return { success: true, message: msg };
}

/**
 * Autonomous Swimmer Self-Check-in via Geofencing
 * Validates GPS coordinates, accuracy, freshness, and Colombo time window on the server.
 */
export async function selfCheckInWithGeofenceAction(
  token: string,
  sessionId: string,
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  },
  devBypass = false
) {
  const swimmer = DataStore.getSwimmerByToken(token);
  if (!swimmer) {
    return { success: false, error: "Invalid swimmer pass token." };
  }

  const session = DataStore.getSessionById(sessionId);
  if (!session) {
    return { success: false, error: "Swimming practice session not found." };
  }

  if (session.status === "cancelled") {
    return { success: false, error: "This swimming practice has been cancelled." };
  }

  if (session.is_finalized) {
    return {
      success: false,
      error: "Attendance for this session has already been finalized by the coach.",
    };
  }

  // Prevent duplicate self-checkins
  const existingAttendance = DataStore.getSessionAttendance(sessionId);
  const myRecord = existingAttendance.find((a) => a.swimmer_id === swimmer.id);
  if (myRecord && (myRecord.status === "present" || myRecord.status === "late")) {
    return {
      success: false,
      error: `You have already checked in as ${myRecord.status.toUpperCase()}!`,
    };
  }

  // Server-Side Geofence & Guardrail Verification (dev bypass strictly forbidden in production)
  const isDev = process.env.NODE_ENV !== "production" && devBypass;
  const validation = validateGeofenceCheckin({
    userLat: coords.latitude,
    userLng: coords.longitude,
    accuracy: coords.accuracy,
    clientTimestamp: coords.timestamp,
    session,
    bypassTimeWindowForDev: isDev,
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
    clientIp = reqHeaders.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
  } catch {
    // headers() graceful fallback
  }

  const reason = `${validation.reason} [IP: ${clientIp}]`;

  // Update DataStore
  const result = DataStore.checkInSwimmerWithGeofence(
    swimmer.id,
    sessionId,
    validation.status,
    validation.distanceMeters,
    coords.accuracy,
    reason
  );

  // Sync to Supabase
  if (result.record) {
    await SupabaseDB.upsertAttendance(result.record, swimmer.id, reason);
  }

  revalidatePath(`/portal/${token}`);
  revalidatePath("/attendance");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/dashboard");

  return {
    success: true,
    record: result.record,
    status: validation.status,
    isLate: validation.isLate,
    minutesLate: validation.minutesLate,
    distanceMeters: validation.distanceMeters,
    radiusMeters: validation.radiusMeters,
  };
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
  const rateCheck = swimmerPinRateLimiter.check(rateLimitKey);
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: `Too many failed PIN attempts. Locked out for ${rateCheck.retryAfterSeconds} seconds.`,
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

  const token = swimmer.reminder_preferences?.opt_out_token || swimmer.id;

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

  const token = swimmer.reminder_preferences?.opt_out_token || swimmer.id;

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

