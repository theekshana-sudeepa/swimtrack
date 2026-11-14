"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { DataStore } from "@/lib/data-store";
import { SupabaseDB } from "@/lib/supabase-db";
import { getSupabaseAdminClient } from "@/lib/supabase-client";
import { sanitizeString } from "@/lib/security";
import { DEFAULT_GEOFENCE_RADIUS_METERS } from "@/lib/geo-fence";

/** Parses and clamps a coach-supplied geofence radius to a sane 25-250 m range. */
function clampGeofenceRadius(raw: string | null | undefined): number {
  const n = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n)) return DEFAULT_GEOFENCE_RADIUS_METERS;
  return Math.min(250, Math.max(25, n));
}

export async function createSessionAction(formData: FormData) {
  await requireAdminSession();
  await DataStore.syncFromSupabase();

  const title = sanitizeString(formData.get("title") as string, 120);
  const date = (formData.get("date") as string)?.trim();
  const start_time = (formData.get("start_time") as string)?.trim();
  const end_time = (formData.get("end_time") as string)?.trim();
  const location = sanitizeString(formData.get("location") as string, 150);
  const notes = sanitizeString(formData.get("notes") as string, 500) || undefined;

  if (!title || !date || !start_time || !end_time || !location) {
    return { error: "Please fill in all required session fields." };
  }

  const rawLat = formData.get("latitude") as string;
  const rawLng = formData.get("longitude") as string;
  const rawRadius = formData.get("geofence_radius") as string;
  const latitude = rawLat && !isNaN(parseFloat(rawLat)) ? parseFloat(rawLat) : undefined;
  const longitude = rawLng && !isNaN(parseFloat(rawLng)) ? parseFloat(rawLng) : undefined;
  const geofence_radius = clampGeofenceRadius(rawRadius);

  const session = DataStore.createSession({
    title,
    date,
    start_time,
    end_time,
    location,
    notes,
    latitude,
    longitude,
    geofence_radius,
  });

  // Persist directly to Supabase Postgres database
  await SupabaseDB.upsertSession(session);

  revalidatePath("/sessions");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/attendance");
  revalidatePath("/portal");

  return { success: true, session };
}

export async function createSeriesAction(formData: FormData) {
  await requireAdminSession();
  await DataStore.syncFromSupabase();

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

  const rawLat = formData.get("latitude") as string;
  const rawLng = formData.get("longitude") as string;
  const rawRadius = formData.get("geofence_radius") as string;
  const latitude = rawLat && !isNaN(parseFloat(rawLat)) ? parseFloat(rawLat) : undefined;
  const longitude = rawLng && !isNaN(parseFloat(rawLng)) ? parseFloat(rawLng) : undefined;
  const geofence_radius = clampGeofenceRadius(rawRadius);

  const result = DataStore.createSeries({
    title,
    location,
    recurrence_rule: "weekly",
    day_of_week,
    start_time,
    end_time,
    start_date,
    occurrences_to_generate: occurrences,
    latitude,
    longitude,
    geofence_radius,
  });

  // Find generated occurrences and batch persist to Supabase Postgres
  const generatedSessions = DataStore.getSessions({ status: "all" }).filter(
    (s) => s.series_id === result.series.id
  );
  await SupabaseDB.insertSeries(result.series, generatedSessions);

  revalidatePath("/sessions");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/attendance");

  return { success: true as const, ...result };
}

export async function updateSessionAction(id: string, formData: FormData) {
  await requireAdminSession();
  await DataStore.syncFromSupabase();

  const existing = DataStore.getSessionById(id);
  if (!existing) {
    return { success: false, error: "Session not found." };
  }

  const title = sanitizeString(formData.get("title") as string, 120) || existing.title;
  const date = (formData.get("date") as string)?.trim() || existing.date;
  const start_time = (formData.get("start_time") as string)?.trim() || existing.start_time;
  const end_time = (formData.get("end_time") as string)?.trim() || existing.end_time;
  const location = sanitizeString(formData.get("location") as string, 150) || existing.location;
  const notes = formData.has("notes")
    ? sanitizeString(formData.get("notes") as string, 500) || null
    : existing.notes;

  const rawLat = formData.get("latitude") as string;
  const rawLng = formData.get("longitude") as string;
  const rawRadius = formData.get("geofence_radius") as string;
  const latitude = rawLat && !isNaN(parseFloat(rawLat)) ? parseFloat(rawLat) : existing.latitude;
  const longitude =
    rawLng && !isNaN(parseFloat(rawLng)) ? parseFloat(rawLng) : existing.longitude;
  const geofence_radius = rawRadius
    ? clampGeofenceRadius(rawRadius)
    : existing.geofence_radius ?? DEFAULT_GEOFENCE_RADIUS_METERS;

  const session = DataStore.updateSession(id, {
    title,
    date,
    start_time,
    end_time,
    location,
    notes,
    latitude,
    longitude,
    geofence_radius,
  });

  if (session) {
    await SupabaseDB.upsertSession(session);
  }

  revalidatePath("/sessions");
  revalidatePath(`/sessions/${id}`);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/attendance");
  revalidatePath("/portal");

  return { success: true, session };
}

/**
 * Updates the pool venue, GPS pin coordinates, and geofence check-in radius for an existing session.
 */
export async function updateSessionLocationAction(
  id: string,
  data: {
    location: string;
    latitude: number;
    longitude: number;
    geofence_radius: number;
  }
) {
  try {
    await requireAdminSession();
    await DataStore.syncFromSupabase();

    const existing = DataStore.getSessionById(id);
    if (!existing) {
      return { success: false as const, error: "Session not found." };
    }

    const location = sanitizeString(data.location, 150);
    if (!location) {
      return { success: false as const, error: "Pool location name is required." };
    }

    const latitude = Number.isFinite(data.latitude)
      ? Math.max(-90, Math.min(90, Number(data.latitude.toFixed(6))))
      : existing.latitude;
    const longitude = Number.isFinite(data.longitude)
      ? Math.max(-180, Math.min(180, Number(data.longitude.toFixed(6))))
      : existing.longitude;
    const geofence_radius = clampGeofenceRadius(String(data.geofence_radius));

    const session = DataStore.updateSession(id, {
      location,
      latitude,
      longitude,
      geofence_radius,
    });

    if (session) {
      await SupabaseDB.upsertSession(session);
    }

    revalidatePath("/sessions");
    revalidatePath(`/sessions/${id}`);
    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    revalidatePath("/attendance");
    revalidatePath("/portal");

    return { success: true as const, session };
  } catch (err) {
    console.error("[updateSessionLocationAction] Error:", err);
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Failed to update pool location.",
    };
  }
}

export async function deleteSessionAction(id: string) {
  try {
    await requireAdminSession();
    await DataStore.syncFromSupabase();

    DataStore.deleteSession(id);
    await SupabaseDB.deleteSession(id);

    revalidatePath("/sessions");
    revalidatePath(`/sessions/${id}`);
    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    revalidatePath("/attendance");
    revalidatePath("/analytics");
    revalidatePath("/swimmers");
    revalidatePath("/portal");

    return { success: true };
  } catch (err) {
    console.error("[deleteSessionAction] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete session",
    };
  }
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

    // Automatically mark any remaining un-marked attendance records as absent
    const { error: attError } = await supabase
      .from("attendance")
      .update({
        status: "absent",
        notes: "Unmarked at finalization",
        updated_at: now,
      })
      .eq("session_id", id)
      .eq("status", "not_marked");

    if (attError) {
      console.error("[finalizeSessionAction] Supabase attendance update error:", attError);
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
  revalidatePath("/swimmers");
  revalidatePath("/portal");

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
