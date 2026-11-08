"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { DataStore } from "@/lib/data-store";
import { SupabaseDB } from "@/lib/supabase-db";

export async function createSessionAction(formData: FormData) {
  await requireAdminSession();

  const title = (formData.get("title") as string)?.trim();
  const date = (formData.get("date") as string)?.trim();
  const start_time = (formData.get("start_time") as string)?.trim();
  const end_time = (formData.get("end_time") as string)?.trim();
  const location = (formData.get("location") as string)?.trim();
  const notes = (formData.get("notes") as string)?.trim() || undefined;

  if (!title || !date || !start_time || !end_time || !location) {
    return { error: "Please fill in all required session fields." };
  }

  const session = DataStore.createSession({
    title,
    date,
    start_time,
    end_time,
    location,
    notes,
  });

  // Persist directly to Supabase Postgres database
  await SupabaseDB.upsertSession(session);

  revalidatePath("/sessions");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/attendance");

  return { success: true, session };
}

export async function createSeriesAction(formData: FormData) {
  await requireAdminSession();

  const title = (formData.get("title") as string)?.trim();
  const location = (formData.get("location") as string)?.trim();
  const day_of_week = parseInt(formData.get("day_of_week") as string, 10);
  const start_time = (formData.get("start_time") as string)?.trim();
  const end_time = (formData.get("end_time") as string)?.trim();
  const start_date = (formData.get("start_date") as string)?.trim();
  const occurrences = parseInt(formData.get("occurrences") as string, 10) || 6;

  if (!title || !location || isNaN(day_of_week) || !start_time || !end_time || !start_date) {
    return { success: false as const, error: "Please fill in all recurring series parameters." };
  }

  const result = DataStore.createSeries({
    title,
    location,
    recurrence_rule: "weekly",
    day_of_week,
    start_time,
    end_time,
    start_date,
    occurrences_to_generate: occurrences,
  });

  revalidatePath("/sessions");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");

  return { success: true as const, ...result };
}

export async function updateSessionAction(id: string, formData: FormData) {
  await requireAdminSession();

  const title = (formData.get("title") as string)?.trim();
  const date = (formData.get("date") as string)?.trim();
  const start_time = (formData.get("start_time") as string)?.trim();
  const end_time = (formData.get("end_time") as string)?.trim();
  const location = (formData.get("location") as string)?.trim();
  const notes = (formData.get("notes") as string)?.trim() || undefined;

  const session = DataStore.updateSession(id, {
    title,
    date,
    start_time,
    end_time,
    location,
    notes,
  });

  revalidatePath("/sessions");
  revalidatePath(`/sessions/${id}`);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");

  return { success: true, session };
}

export async function cancelSessionAction(id: string) {
  await requireAdminSession();
  DataStore.cancelSession(id);
  revalidatePath("/sessions");
  revalidatePath(`/sessions/${id}`);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function finalizeSessionAction(id: string) {
  const admin = await requireAdminSession();
  DataStore.finalizeSession(id, admin.id);
  revalidatePath("/sessions");
  revalidatePath(`/sessions/${id}`);
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  return { success: true };
}

export async function reopenSessionAction(id: string) {
  await requireAdminSession();
  DataStore.reopenSession(id);
  revalidatePath("/sessions");
  revalidatePath(`/sessions/${id}`);
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  return { success: true };
}
