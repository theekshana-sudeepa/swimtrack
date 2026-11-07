"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { DataStore } from "@/lib/data-store";

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
