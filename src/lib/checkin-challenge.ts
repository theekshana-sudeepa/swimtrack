import crypto from "crypto";

/**
 * Stateless, HMAC-signed, single-use check-in challenges.
 *
 * A swimmer must first obtain a challenge from the server (bound to their swimmer id and the
 * session), then present it with the GPS payload. This means:
 *  - a captured check-in request cannot be replayed (single use + short TTL),
 *  - a request cannot be re-targeted to another swimmer or session,
 *  - blind forged calls without a server-issued challenge are rejected.
 *
 * NOTE: a browser can never prove its GPS reading is genuine - this raises the bar, it does not
 * make spoofing impossible. Coach review (shown on the register) remains the backstop.
 */

export const CHECKIN_CHALLENGE_TTL_MS = 3 * 60 * 1000;

const consumed = new Map<string, number>(); // nonce -> expiry (best-effort, per instance)

function getSecret(): string {
  return (
    process.env.CHECKIN_CHALLENGE_SECRET ||
    process.env.ADMIN_PASSWORD ||
    process.env.CRON_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "swimtrack_checkin_challenge_secret_2026"
  );
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function pruneConsumed(now: number) {
  for (const [nonce, expiry] of consumed) {
    if (expiry <= now) consumed.delete(nonce);
  }
}

/**
 * `stateStamp` fingerprints the swimmer's attendance row at issue time (status + updated_at).
 * Once ANY write happens to that row (e.g. a successful check-in), the challenge no longer
 * verifies - on every server instance, with no shared storage needed.
 */
export function attendanceStateStamp(
  record?: { status?: string | null; updated_at?: string | null } | null
): string {
  return `${record?.status ?? "none"}~${record?.updated_at ?? ""}`;
}

export function issueCheckinChallenge(
  swimmerId: string,
  sessionId: string,
  stateStamp: string = "",
  now: number = Date.now()
): string {
  const nonce = crypto.randomBytes(12).toString("hex");
  const payload = `${swimmerId}|${sessionId}|${now}|${nonce}|${stateStamp}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export type ChallengeCheck =
  | { ok: true; nonce: string }
  | { ok: false; error: string };

/** Pure verification (does NOT consume). */
export function verifyCheckinChallenge(
  challenge: string | undefined | null,
  swimmerId: string,
  sessionId: string,
  stateStamp: string = "",
  now: number = Date.now()
): ChallengeCheck {
  const fail = (error: string): ChallengeCheck => ({ ok: false, error });
  if (!challenge || typeof challenge !== "string" || challenge.length > 600) {
    return fail("Check-in session expired. Please tap Check In again.");
  }

  const [b64, sig] = challenge.split(".");
  if (!b64 || !sig) return fail("Invalid check-in request. Please try again.");

  let payload: string;
  try {
    payload = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return fail("Invalid check-in request. Please try again.");
  }

  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return fail("Invalid check-in request. Please try again.");
  }

  const [pSwimmer, pSession, pIssued, nonce, ...stampParts] = payload.split("|");
  if (pSwimmer !== swimmerId || pSession !== sessionId) {
    return fail("Invalid check-in request. Please try again.");
  }

  const issuedAt = Number(pIssued);
  if (!Number.isFinite(issuedAt) || issuedAt > now + 5_000 || now - issuedAt > CHECKIN_CHALLENGE_TTL_MS) {
    return fail("Check-in session expired. Please tap Check In again.");
  }

  if (stampParts.join("|") !== stateStamp) {
    return fail("Your attendance changed since you tapped Check In. Please tap it again.");
  }

  if (consumed.has(nonce)) {
    return fail("This check-in request was already used. Please tap Check In again.");
  }

  return { ok: true, nonce };
}

/** Marks a verified challenge as used. Returns false if it was already consumed. */
export function consumeCheckinChallenge(nonce: string, now: number = Date.now()): boolean {
  pruneConsumed(now);
  if (consumed.has(nonce)) return false;
  consumed.set(nonce, now + CHECKIN_CHALLENGE_TTL_MS + 10_000);
  return true;
}

/**
 * Anti-buddy-punching device lock cookie.
 * Binds a browser/phone to the first swimmer who checks in for a given session so the same phone
 * at the pool cannot log into a second swimmer's account and check them in too.
 */
export const DEVICE_CHECKIN_COOKIE_NAME = "swimtrack_device_checkin";
export const DEVICE_CHECKIN_TTL_MS = 18 * 60 * 60 * 1000; // 18 hours

export function createDeviceCheckinToken(
  sessionId: string,
  swimmerId: string,
  now: number = Date.now()
): string {
  const payload = `dev|${sessionId}|${swimmerId}|${now}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

/**
 * If `cookieVal` is a valid, un-expired device lock for `sessionId`, returns the swimmerId bound
 * to that device; otherwise returns null.
 */
export function getDeviceBoundSwimmer(
  cookieVal: string | undefined | null,
  sessionId: string,
  now: number = Date.now()
): string | null {
  if (!cookieVal || typeof cookieVal !== "string" || cookieVal.length > 600) return null;
  const [b64, sig] = cookieVal.split(".");
  if (!b64 || !sig) return null;

  let payload: string;
  try {
    payload = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const [prefix, pSession, pSwimmer, pIssued] = payload.split("|");
  if (prefix !== "dev" || pSession !== sessionId || !pSwimmer) return null;

  const issuedAt = Number(pIssued);
  if (!Number.isFinite(issuedAt) || now - issuedAt > DEVICE_CHECKIN_TTL_MS) return null;

  return pSwimmer;
}

/** Test helper. */
export function _resetCheckinChallengesForTests() {
  consumed.clear();
}
