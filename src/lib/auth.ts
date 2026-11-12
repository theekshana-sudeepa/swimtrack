import { cookies } from "next/headers";
import crypto from "crypto";
import { getSupabaseClient } from "./supabase-client";
import { timingSafeMatch } from "./security";

export const ADMIN_COOKIE_NAME = "swimtrack_admin_session";
export const SWIMMER_COOKIE_NAME = "swimtrack_swimmer_session";
export const DEMO_ADMIN_TOKEN = "swimtrack_demo_admin_authenticated_2026";

export interface AdminUser {
  id: string;
  email: string;
  isDemo: boolean;
}

function getAuthSecret(): string {
  return (
    process.env.ADMIN_PASSWORD ||
    process.env.CRON_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "swimtrack_secure_auth_secret_2026"
  );
}

/**
 * Creates a cryptographically signed HMAC token for the administrator session.
 */
export function createAdminSessionToken(email: string): string {
  const timestamp = Date.now();
  const payload = `${email.toLowerCase()}:${timestamp}`;
  const hmac = crypto
    .createHmac("sha256", getAuthSecret())
    .update(payload)
    .digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${hmac}`;
}

/**
 * Verifies a cryptographically signed administrator session token.
 */
export function verifyAdminSessionToken(token: string): { valid: boolean; email?: string } {
  if (!token) return { valid: false };

  // In production, reject any legacy demo token unconditionally
  if (token === DEMO_ADMIN_TOKEN) {
    if (process.env.NODE_ENV === "production") {
      return { valid: false };
    }
    return { valid: true, email: process.env.ADMIN_EMAIL || "admin@example.com" };
  }

  if (!token.includes(".")) {
    return { valid: false };
  }

  try {
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) return { valid: false };

    const payload = Buffer.from(encodedPayload, "base64url").toString("utf-8");
    const [email, timestampStr] = payload.split(":");
    const timestamp = parseInt(timestampStr, 10);

    // Max session age: 7 days
    if (isNaN(timestamp) || Date.now() - timestamp > 1000 * 60 * 60 * 24 * 7) {
      return { valid: false };
    }

    const expectedHmac = crypto
      .createHmac("sha256", getAuthSecret())
      .update(payload)
      .digest("hex");

    if (!timingSafeMatch(signature, expectedHmac)) {
      return { valid: false };
    }

    return { valid: true, email };
  } catch {
    return { valid: false };
  }
}

/**
 * Checks if Supabase credentials are configured or if app is in standalone demo mode.
 */
export function isDemoMode(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !url || url.includes("your-project-id");
}

/**
 * Checks if a given user ID or email matches the strict allowlist from environment variables.
 */
export function isAdminAllowlisted(userId: string, email?: string): boolean {
  const adminId = process.env.ADMIN_USER_ID;
  const adminEmail = process.env.ADMIN_EMAIL;

  if (adminId && userId === adminId) return true;
  if (adminEmail && email && email.toLowerCase() === adminEmail.toLowerCase()) return true;

  // In local dev demo mode without configured envs, allow default admin email
  if (isDemoMode() && process.env.NODE_ENV !== "production" && (email === "admin@example.com" || userId === "demo-admin-id")) {
    return true;
  }

  return false;
}

/**
 * Server-side guard to get and verify the current administrator session.
 * Used in Server Components, Server Actions, and Route Handlers.
 */
export async function getAdminSession(): Promise<AdminUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  // 1. Verify cryptographically signed token
  const tokenCheck = verifyAdminSessionToken(sessionToken);
  if (tokenCheck.valid && tokenCheck.email) {
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase();
    if (tokenCheck.email.toLowerCase() === adminEmail) {
      return {
        id: "admin-id",
        email: tokenCheck.email,
        isDemo: isDemoMode(),
      };
    }
  }

  // 2. If live Supabase client exists, verify session with Supabase Auth
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(sessionToken);
      if (error || !user) return null;

      if (!isAdminAllowlisted(user.id, user.email)) {
        return null;
      }

      return {
        id: user.id,
        email: user.email || "",
        isDemo: false,
      };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Enforces admin authorization. Throws Error if unauthorized.
 */
export async function requireAdminSession(): Promise<AdminUser> {
  const session = await getAdminSession();
  if (!session) {
    throw new Error("Unauthorized: Administrator access required.");
  }
  return session;
}
