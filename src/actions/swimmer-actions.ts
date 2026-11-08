"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { DataStore } from "@/lib/data-store";
import { sendWelcomeEmail } from "@/lib/resend-service";
import { Swimmer } from "@/types/database";

export async function createSwimmerAction(formData: FormData) {
  await requireAdminSession();

  const full_name = (formData.get("full_name") as string)?.trim();
  const nickname = (formData.get("nickname") as string)?.trim() || undefined;
  const email = (formData.get("email") as string)?.trim() || undefined;
  const phone = (formData.get("phone") as string)?.trim() || undefined;
  const notes = (formData.get("notes") as string)?.trim() || undefined;
  const avatar_color = (formData.get("avatar_color") as string) || "ocean";
  const email_reminders_enabled = formData.get("email_reminders_enabled") === "on";

  if (!full_name) {
    return { error: "Swimmer's full name is required." };
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

  revalidatePath("/swimmers");
  revalidatePath("/attendance");
  revalidatePath("/dashboard");

  return { success: true, swimmer };
}

export async function updateSwimmerAction(id: string, formData: FormData) {
  await requireAdminSession();

  const full_name = (formData.get("full_name") as string)?.trim();
  const nickname = (formData.get("nickname") as string)?.trim() || undefined;
  const email = (formData.get("email") as string)?.trim() || undefined;
  const phone = (formData.get("phone") as string)?.trim() || undefined;
  const notes = (formData.get("notes") as string)?.trim() || undefined;
  const avatar_color = (formData.get("avatar_color") as string) || undefined;
  const email_reminders_enabled = formData.get("email_reminders_enabled") === "on";

  if (!full_name) {
    return { error: "Swimmer's full name is required." };
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

  revalidatePath("/swimmers");
  revalidatePath(`/swimmers/${id}`);
  revalidatePath("/attendance");

  return { success: true, swimmer: updated };
}

export async function archiveSwimmerAction(id: string) {
  await requireAdminSession();
  DataStore.archiveSwimmer(id);
  revalidatePath("/swimmers");
  revalidatePath(`/swimmers/${id}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function restoreSwimmerAction(id: string) {
  await requireAdminSession();
  DataStore.restoreSwimmer(id);
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
  const full_name = (formData.get("full_name") as string)?.trim();
  const nickname = (formData.get("nickname") as string)?.trim() || undefined;
  const email = (formData.get("email") as string)?.trim() || undefined;
  const phone = (formData.get("phone") as string)?.trim() || undefined;
  const email_reminders_enabled = formData.get("email_reminders_enabled") === "on";

  if (!full_name || full_name.length < 2) {
    return { success: false, error: "Please enter your full name (at least 2 characters)." };
  }

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
  } else {
    swimmer = DataStore.createSwimmer({
      full_name,
      nickname,
      email,
      phone,
      email_reminders_enabled: email ? email_reminders_enabled : false,
      notes: "Self-registered via squad invite link",
    });
  }

  // Dispatch welcome email if email is provided
  if (email && email.includes("@") && email_reminders_enabled) {
    try {
      await sendWelcomeEmail({ swimmer });
    } catch (err) {
      console.error("Welcome email delivery failed:", err);
    }
  }

  revalidatePath("/swimmers");
  revalidatePath("/attendance");
  revalidatePath("/dashboard");

  return { success: true, swimmer, isExisting };
}

