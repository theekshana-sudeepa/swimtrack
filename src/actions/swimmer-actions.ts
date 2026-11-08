"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireAdminSession } from "@/lib/auth";
import { DataStore } from "@/lib/data-store";
import { SupabaseDB } from "@/lib/supabase-db";
import { sendWelcomeEmail, sendAdminNewSwimmerAlert } from "@/lib/resend-service";
import { Swimmer } from "@/types/database";
import { sanitizeString, sanitizeEmail, sanitizePhone, extractClientIp } from "@/lib/security";
import { joinRateLimiter } from "@/lib/rate-limiter";

export async function createSwimmerAction(formData: FormData) {
  await requireAdminSession();

  const full_name = sanitizeString(formData.get("full_name") as string, 100);
  const nickname = sanitizeString(formData.get("nickname") as string, 50) || undefined;
  const email = sanitizeEmail(formData.get("email") as string) || undefined;
  const phone = sanitizePhone(formData.get("phone") as string) || undefined;
  const notes = sanitizeString(formData.get("notes") as string, 500) || undefined;
  const avatar_color = (formData.get("avatar_color") as string) || "ocean";
  const email_reminders_enabled = formData.get("email_reminders_enabled") === "on";

  if (!full_name || full_name.length < 2) {
    return { error: "Please enter a valid swimmer name (at least 2 characters)." };
  }

  const swimmer = DataStore.createSwimmer({
    full_name,
    nickname,
    email,
    phone,
    notes,
    avatar_color,
    email_reminders_enabled: email ? email_reminders_enabled : false,
  });

  // Persist directly to Supabase Postgres database
  await SupabaseDB.insertSwimmer(swimmer);

  // Automatically dispatch Welcome Pass email if email provided
  if (email && email.includes("@")) {
    try {
      await sendWelcomeEmail({ swimmer });
    } catch (e) {
      console.error("Welcome email failed:", e);
    }
  }

  // Dispatch alert notification to admin
  try {
    await sendAdminNewSwimmerAlert({ swimmer });
  } catch (err) {
    console.error("Admin registration alert delivery failed:", err);
  }

  revalidatePath("/swimmers");
  revalidatePath("/attendance");
  revalidatePath("/dashboard");

  return { success: true, swimmer };
}

export async function updateSwimmerAction(id: string, formData: FormData) {
  await requireAdminSession();

  const full_name = sanitizeString(formData.get("full_name") as string, 100);
  const nickname = sanitizeString(formData.get("nickname") as string, 50) || undefined;
  const email = sanitizeEmail(formData.get("email") as string) || undefined;
  const phone = sanitizePhone(formData.get("phone") as string) || undefined;
  const notes = sanitizeString(formData.get("notes") as string, 500) || undefined;
  const avatar_color = (formData.get("avatar_color") as string) || undefined;
  const email_reminders_enabled = formData.get("email_reminders_enabled") === "on";

  if (!full_name || full_name.length < 2) {
    return { error: "Please enter a valid swimmer name (at least 2 characters)." };
  }

  const updated = DataStore.updateSwimmer(id, {
    full_name,
    nickname,
    email,
    phone,
    notes,
    avatar_color,
    email_reminders_enabled,
  });

  // Persist directly to Supabase Postgres database
  await SupabaseDB.updateSwimmer(id, {
    full_name,
    nickname,
    email,
    phone,
    notes,
    avatar_color,
    email_reminders_enabled,
  });

  revalidatePath("/swimmers");
  revalidatePath(`/swimmers/${id}`);
  revalidatePath("/attendance");

  return { success: true, swimmer: updated };
}

export async function archiveSwimmerAction(id: string) {
  await requireAdminSession();
  DataStore.archiveSwimmer(id);
  await SupabaseDB.archiveSwimmer(id);
  revalidatePath("/swimmers");
  revalidatePath(`/swimmers/${id}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function restoreSwimmerAction(id: string) {
  await requireAdminSession();
  DataStore.restoreSwimmer(id);
  await SupabaseDB.restoreSwimmer(id);
  revalidatePath("/swimmers");
  revalidatePath(`/swimmers/${id}`);
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * Public action for friends to self-join the squad roster via invite link.
 * Does not require admin authentication or password creation.
 */
export async function joinSquadAction(formData: FormData): Promise<{
  success: boolean;
  swimmer?: Swimmer;
  error?: string;
  isExisting?: boolean;
}> {
  // Rate limiting against registration floods/spam
  const headerList = await headers();
  const clientIp = extractClientIp(headerList);
  const rateKey = `join_${clientIp}`;
  const rateCheck = joinRateLimiter.check(rateKey);

  if (!rateCheck.allowed) {
    return {
      success: false,
      error: `Too many registration attempts from this network. Please wait ${Math.ceil(rateCheck.retryAfterSeconds / 60)} minutes before trying again.`,
    };
  }

  const full_name = sanitizeString(formData.get("full_name") as string, 100);
  const nickname = sanitizeString(formData.get("nickname") as string, 50) || undefined;
  const email = sanitizeEmail(formData.get("email") as string) || undefined;
  const phone = sanitizePhone(formData.get("phone") as string) || undefined;
  const email_reminders_enabled = formData.get("email_reminders_enabled") === "on";

  if (!full_name || full_name.length < 2) {
    joinRateLimiter.recordFailure(rateKey);
    return { success: false, error: "Please enter your full name (at least 2 characters)." };
  }

  // Ensure latest squad state from Supabase
  await DataStore.syncFromSupabase();

  // Check if swimmer already exists with the same email or full name
  const existingList = DataStore.getSwimmers({ status: "all" });
  const existingByEmail = email
    ? existingList.find((s) => s.email && s.email.toLowerCase() === email.toLowerCase())
    : null;
  const existingByName = existingList.find(
    (s) => s.full_name.toLowerCase() === full_name.toLowerCase()
  );

  let swimmer: Swimmer;
  let isExisting = false;

  if (existingByEmail) {
    isExisting = true;
    const updated = DataStore.updateSwimmer(existingByEmail.id, {
      full_name,
      nickname: nickname || existingByEmail.nickname || undefined,
      phone: phone || existingByEmail.phone || undefined,
      email_reminders_enabled: email ? email_reminders_enabled : false,
    });
    if (!updated) {
      return { success: false, error: "Failed to update existing swimmer profile." };
    }
    swimmer = updated;
    await SupabaseDB.updateSwimmer(existingByEmail.id, {
      full_name,
      nickname: nickname || existingByEmail.nickname || undefined,
      phone: phone || existingByEmail.phone || undefined,
      email_reminders_enabled: email ? email_reminders_enabled : false,
    });
  } else if (existingByName) {
    isExisting = true;
    const updated = DataStore.updateSwimmer(existingByName.id, {
      nickname: nickname || existingByName.nickname || undefined,
      email: email || existingByName.email || undefined,
      phone: phone || existingByName.phone || undefined,
      email_reminders_enabled: email ? email_reminders_enabled : false,
    });
    if (!updated) {
      return { success: false, error: "Failed to update existing swimmer profile." };
    }
    swimmer = updated;
    await SupabaseDB.updateSwimmer(existingByName.id, {
      nickname: nickname || existingByName.nickname || undefined,
      email: email || existingByName.email || undefined,
      phone: phone || existingByName.phone || undefined,
      email_reminders_enabled: email ? email_reminders_enabled : false,
    });
  } else {
    swimmer = DataStore.createSwimmer({
      full_name,
      nickname,
      email,
      phone,
      email_reminders_enabled: email ? email_reminders_enabled : false,
      notes: "Self-registered via squad invite link",
    });
    // Persist directly to Supabase Postgres database & auto-enroll in scheduled sessions
    await SupabaseDB.insertSwimmer(swimmer);
  }

  // Dispatch welcome email whenever an email address is provided
  if (email && email.includes("@")) {
    try {
      await sendWelcomeEmail({ swimmer });
    } catch (err) {
      console.error("Welcome email delivery failed:", err);
    }
  }

  // Dispatch alert notification to admin
  try {
    await sendAdminNewSwimmerAlert({ swimmer });
  } catch (err) {
    console.error("Admin registration alert delivery failed:", err);
  }

  revalidatePath("/swimmers");
  revalidatePath("/attendance");
  revalidatePath("/dashboard");

  joinRateLimiter.reset(rateKey);

  return { success: true, swimmer, isExisting };
}

