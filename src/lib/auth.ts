import { cookies } from "next/headers";
import { getSupabaseClient } from "./supabase-client";

export const ADMIN_COOKIE_NAME = "swimtrack_admin_session";
export const DEMO_ADMIN_TOKEN = "swimtrack_demo_admin_authenticated_2026";

export interface AdminUser {
  id: string;
  email: string;
  isDemo: boolean;
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

  // In demo mode without configured envs, allow the designated demo admin email
  if (isDemoMode() && (email === "admin@example.com" || userId === "demo-admin-id")) {
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

  // Check demo session token
  if (sessionToken === DEMO_ADMIN_TOKEN) {
    return {
      id: "demo-admin-id",
      email: process.env.ADMIN_EMAIL || "admin@example.com",
      isDemo: true,
    };
  }

  // If live Supabase client exists, verify session with Supabase Auth
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
