"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { DataStore } from "@/lib/data-store";
import { SupabaseDB } from "@/lib/supabase-db";
import { getSupabaseAdminClient } from "@/lib/supabase-client";
import { sanitizeString } from "@/lib/security";

export async function createSessionAction(formData: FormData) {
  await requireAdminSession();

  const title = sanitizeString(formData.get("title") as string, 120);
  const date = (formData.get("date") as string)?.trim();
  const start_time = (formData.get("start_time") as string)?.trim();
  const end_time = (formData.get("end_time") as string)?.trim();
  const location = sanitizeString(formData.get("location") as string, 150);
  const notes = sanitizeString(formData.get("notes") as string, 500) || undefined;

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

  const title = sanitizeString(formData.get("title") as string, 120);
  const location = sanitizeString(formData.get("location") as string, 150);
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
  await DataStore.syncFromSupabase();
  const session = DataStore.cancelSession(id);

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const now = new Date().toISOString();
    await supabase
      .from("swim_sessions")
      .update({ status: "cancelled", updated_at: now })
      .eq("id", id);
  }

  if (session) {
    await SupabaseDB.upsertSession(session);
  }

  revalidatePath("/sessions");
  revalidatePath(`/sessions/${id}`);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function finalizeSessionAction(id: string) {
  const admin = await requireAdminSession();
  // Ensure stateless lambda has fresh session state from Supabase
  await DataStore.syncFromSupabase();

  const session = DataStore.finalizeSession(id, admin.id);

  // Directly update Supabase Postgres swim_sessions table
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const now = new Date().toISOString();
    const isValidUuid = (val?: string | null) =>
      typeof val === "string" &&
      val.length === 36 &&
      val !== "00000000-0000-0000-0000-000000000000";

    const updatePayload: Record<string, unknown> = {
      status: "completed",
      is_finalized: true,
      finalized_at: now,
      updated_at: now,
    };

    if (isValidUuid(admin.id)) {
      updatePayload.finalized_by = admin.id;
    }

    const { error } = await supabase
      .from("swim_sessions")
      .update(updatePayload)
      .eq("id", id);

    if (error) {
      console.error("[finalizeSessionAction] Supabase update error:", error);
    }
  }

  if (session) {
    await SupabaseDB.upsertSession(session);
  }

  revalidatePath("/sessions");
  revalidatePath(`/sessions/${id}`);
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  revalidatePath("/calendar");

  return { success: true, is_finalized: true, status: "completed" };
}

export async function reopenSessionAction(id: string) {
  await requireAdminSession();
  // Ensure stateless lambda has fresh session state from Supabase
  await DataStore.syncFromSupabase();

  const session = DataStore.reopenSession(id);

  // Directly update Supabase Postgres swim_sessions table
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("swim_sessions")
      .update({
        status: "scheduled",
        is_finalized: false,
        finalized_at: null,
        finalized_by: null,
        updated_at: now,
      })
      .eq("id", id);

    if (error) {
      console.error("[reopenSessionAction] Supabase update error:", error);
    }
  }

  if (session) {
    await SupabaseDB.upsertSession(session);
  }

  revalidatePath("/sessions");
  revalidatePath(`/sessions/${id}`);
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  revalidatePath("/calendar");

  return { success: true, is_finalized: false, status: "scheduled" };
}
