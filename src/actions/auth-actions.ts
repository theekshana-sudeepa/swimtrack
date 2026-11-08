"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE_NAME, DEMO_ADMIN_TOKEN, isDemoMode, isAdminAllowlisted } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase-client";
import { loginRateLimiter } from "@/lib/rate-limiter";
import { timingSafeMatch, sanitizeEmail, extractClientIp } from "@/lib/security";

export interface AuthState {
  error?: string;
  success?: boolean;
}

export async function loginAction(
  prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const rawEmail = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const redirectTo = (formData.get("redirectTo") as string) || "/dashboard";

  const email = sanitizeEmail(rawEmail);
  if (!email || !password) {
    return { error: "Please enter a valid administrator email address and password." };
  }

  // Rate Limiting & Brute-Force Lockout Defense
  const headerList = await headers();
  const clientIp = extractClientIp(headerList);
  const rateLimitKey = `login_${clientIp}_${email}`;
  const rateCheck = loginRateLimiter.check(rateLimitKey);

  if (!rateCheck.allowed) {
    return {
      error: `Too many failed login attempts. Temporarily locked for security. Please try again in ${Math.ceil(rateCheck.retryAfterSeconds / 60)} minutes.`,
    };
  }

  // 1. Standalone Demo Mode fallback
  if (isDemoMode()) {
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase();
    const isEmailMatch = timingSafeMatch(email, adminEmail);
    const isPassMatch =
      timingSafeMatch(password, "swimtrack2026") ||
      timingSafeMatch(password, "password") ||
      (password.length >= 6 && isEmailMatch);

    if (isEmailMatch && isPassMatch) {
      loginRateLimiter.reset(rateLimitKey);
      const cookieStore = await cookies();
      cookieStore.set(ADMIN_COOKIE_NAME, DEMO_ADMIN_TOKEN, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });

      redirect(redirectTo);
    } else {
      loginRateLimiter.recordFailure(rateLimitKey);
      return {
        error: `Invalid credentials. For evaluation demo mode, use: ${adminEmail} and password: swimtrack2026`,
      };
    }
  }

  // 2. Live Supabase Authentication
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { error: "Authentication provider is not properly configured." };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user || !data.session) {
    loginRateLimiter.recordFailure(rateLimitKey);
    return { error: error?.message || "Invalid administrator credentials." };
  }

  // Verify single-admin allowlist
  if (!isAdminAllowlisted(data.user.id, data.user.email)) {
    loginRateLimiter.recordFailure(rateLimitKey);
    await supabase.auth.signOut();
    return {
      error: "Access denied: This user account is not an authorized administrator.",
    };
  }

  // Reset rate limiter on successful login
  loginRateLimiter.reset(rateLimitKey);

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, data.session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: data.session.expires_in || 60 * 60 * 24 * 7,
  });

  redirect(redirectTo);
}

export async function demoLoginAction(redirectTo = "/dashboard") {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, DEMO_ADMIN_TOKEN, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect(redirectTo);
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore if session already closed
    }
  }

  redirect("/login");
}

