import crypto from "crypto";

/**
 * Constant-time string comparison to prevent timing attacks.
 * Safely compares two secret strings (such as tokens or passwords)
 * without leaking length or content via execution time.
 */
export function timingSafeMatch(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  // Hash both inputs with SHA-256 to ensure identical buffer length
  // before running timingSafeEqual, avoiding length-leakage attacks.
  const hashA = crypto.createHash("sha256").update(a, "utf8").digest();
  const hashB = crypto.createHash("sha256").update(b, "utf8").digest();

  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Hashes a swimmer's 4-digit PIN with a salt and the swimmer ID to prevent rainbow table attacks.
 */
export function hashSwimmerPin(swimmerId: string, pin: string): string {
  const salt = process.env.SWIMMER_PIN_SALT || "swimtrack-squad-pin-salt-2026";
  return crypto
    .createHash("sha256")
    .update(`${swimmerId}:${pin.trim()}:${salt}`, "utf8")
    .digest("hex");
}

/**
 * Constant-time verification of a swimmer's 4-digit PIN.
 * Supports hashed PINs and handles legacy plain PINs gracefully.
 */
export function verifySwimmerPinSecure(
  swimmerId: string,
  inputPin: string,
  storedVal?: string | null
): boolean {
  if (!storedVal || typeof storedVal !== "string" || !inputPin || typeof inputPin !== "string") {
    return false;
  }
  const cleanPin = inputPin.trim();
  const cleanStored = storedVal.trim();

  // 1. Check against modern hashed PIN
  const computedHash = hashSwimmerPin(swimmerId, cleanPin);
  if (timingSafeMatch(computedHash, cleanStored)) {
    return true;
  }

  // 2. Backward compatibility fallback for plain 4-digit PIN
  if (cleanStored.length === 4 && timingSafeMatch(cleanPin, cleanStored)) {
    return true;
  }

  return false;
}

/**
 * Strips dangerous HTML tags, inline scripts, event handlers, and null bytes.
 * Sanitizes input to prevent Stored & Reflected Cross-Site Scripting (XSS).
 */
export function sanitizeString(val?: string | null, maxLength = 1000): string {
  if (!val || typeof val !== "string") return "";

  let clean = val
    // Strip null bytes and control characters
    .replace(/\0/g, "")
    // Strip script and iframe tags entirely
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    // Strip HTML tags
    .replace(/<[^>]+>/g, "")
    // Strip javascript: and vbscript: pseudo protocols
    .replace(/javascript:/gi, "")
    .replace(/vbscript:/gi, "")
    // Strip inline event attributes like onerror=, onclick=
    .replace(/on\w+\s*=/gi, "")
    .trim();

  if (maxLength && clean.length > maxLength) {
    clean = clean.slice(0, maxLength);
  }

  return clean;
}

/**
 * Validates and sanitizes email address.
 * Prevents SMTP header injection (CRLF), strips whitespace, enforces lowercase.
 */
export function sanitizeEmail(email?: string | null): string | null {
  if (!email || typeof email !== "string") return null;

  // Disallow CRLF characters entirely to prevent header injection
  if (/[\r\n\t]/.test(email)) {
    return null;
  }

  const clean = email.trim().toLowerCase();

  // Standard RFC-compliant email regex pattern
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(clean) || clean.length > 254) {
    return null;
  }

  return clean;
}

/**
 * Validates and sanitizes phone numbers.
 * Allows only digits, plus sign, spaces, hyphens, and parentheses.
 */
export function sanitizePhone(phone?: string | null): string | null {
  if (!phone || typeof phone !== "string") return null;

  // Disallow CRLF
  if (/[\r\n]/.test(phone)) return null;

  const clean = phone.trim();
  // Strip anything that is not +, digit, space, hyphen, or parenthesis
  const sanitized = clean.replace(/[^\d+\s\-()]/g, "");

  if (sanitized.length < 5 || sanitized.length > 25) {
    return null;
  }

  return sanitized;
}

/**
 * Helper to extract client IP address from server action / route headers.
 */
export function extractClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for can be a comma-separated list; first IP is the original client
    const ip = forwardedFor.split(",")[0].trim();
    if (ip) return ip;
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  return "127.0.0.1";
}


/**
 * Generates an unguessable swimmer pass token (192 bits of entropy).
 * Never derive tokens from swimmer ids, names or emails - those are not secrets.
 */
export function generateSwimmerToken(): string {
  return `st_${crypto.randomBytes(24).toString("base64url")}`;
}

/** True only for tokens minted by generateSwimmerToken(). */
export function isStrongSwimmerToken(token: unknown): boolean {
  return typeof token === "string" && /^st_[A-Za-z0-9_-]{32}$/.test(token);
}
