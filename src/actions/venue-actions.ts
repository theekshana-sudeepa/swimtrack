"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { DataStore } from "@/lib/data-store";
import { SupabaseDB } from "@/lib/supabase-db";
import { sanitizeString } from "@/lib/security";
import { clampGeofenceRadiusMeters, deriveShortVenueName } from "@/lib/geo-fence";
import type { PoolVenue } from "@/types/database";

function revalidateVenuePaths() {
  revalidatePath("/settings");
  revalidatePath("/sessions");
  revalidatePath("/attendance");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/portal");
}

function validateCoordinates(latitude: number, longitude: number): {
  ok: boolean;
  lat: number;
  lng: number;
  error?: string;
} {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ok: false, lat: 0, lng: 0, error: "Valid GPS latitude and longitude are required." };
  }
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return { ok: false, lat: 0, lng: 0, error: "GPS coordinates are out of valid Earth bounds." };
  }
  return {
    ok: true,
    lat: Number(latitude.toFixed(6)),
    lng: Number(longitude.toFixed(6)),
  };
}

async function applyVenueToUpcomingScheduledSessions(venue: PoolVenue): Promise<number> {
  const scheduledSessions = DataStore.getSessions({ status: "scheduled" }).filter(
    (s) => !s.is_finalized
  );
  let count = 0;
  for (const sess of scheduledSessions) {
    const updated = DataStore.updateSession(sess.id, {
      location: venue.name,
      venue_id: venue.id,
      latitude: venue.latitude,
      longitude: venue.longitude,
      geofence_radius: venue.radius_meters,
    });
    if (updated) {
      await SupabaseDB.upsertSession(updated);
      count++;
    }
  }
  return count;
}

export async function createVenueAction(data: {
  name: string;
  short_name?: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_default?: boolean;
  notes?: string | null;
  apply_to_upcoming?: boolean;
}): Promise<{
  success: boolean;
  venue?: PoolVenue;
  venues?: PoolVenue[];
  updatedSessionsCount?: number;
  error?: string;
}> {
  try {
    await requireAdminSession();
    await DataStore.syncFromSupabase();

    const name = sanitizeString(data.name, 150);
    if (!name) {
      return { success: false, error: "Swimming place name is required." };
    }

    const coordCheck = validateCoordinates(Number(data.latitude), Number(data.longitude));
    if (!coordCheck.ok) {
      return { success: false, error: coordCheck.error };
    }

    const short_name =
      sanitizeString(data.short_name || "", 60) || deriveShortVenueName(name);
    const notes = sanitizeString(data.notes || "", 240) || null;
    const radius_meters = clampGeofenceRadiusMeters(data.radius_meters);

    const venue = DataStore.createVenue({
      name,
      short_name,
      latitude: coordCheck.lat,
      longitude: coordCheck.lng,
      radius_meters,
      is_default: Boolean(data.is_default),
      notes,
    });

    const venues = DataStore.getSavedVenues();
    await SupabaseDB.syncVenues(venues);

    let updatedSessionsCount = 0;
    if (data.apply_to_upcoming) {
      updatedSessionsCount = await applyVenueToUpcomingScheduledSessions(venue);
    }

    revalidateVenuePaths();
    return { success: true, venue, venues, updatedSessionsCount };
  } catch (err) {
    console.error("[createVenueAction] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save swimming place.",
    };
  }
}

export async function updateVenueAction(
  id: string,
  data: {
    name?: string;
    short_name?: string | null;
    latitude?: number;
    longitude?: number;
    radius_meters?: number;
    is_default?: boolean;
    notes?: string | null;
    apply_to_upcoming?: boolean;
  }
): Promise<{
  success: boolean;
  venue?: PoolVenue;
  venues?: PoolVenue[];
  updatedSessionsCount?: number;
  error?: string;
}> {
  try {
    await requireAdminSession();
    await DataStore.syncFromSupabase();

    const existing = DataStore.getVenueById(id);
    if (!existing) {
      return { success: false, error: "Swimming place not found." };
    }

    const name =
      data.name !== undefined ? sanitizeString(data.name, 150) : existing.name;
    if (!name) {
      return { success: false, error: "Swimming place name cannot be empty." };
    }

    let nextLat = existing.latitude;
    let nextLng = existing.longitude;
    if (data.latitude !== undefined || data.longitude !== undefined) {
      const coordCheck = validateCoordinates(
        Number(data.latitude ?? existing.latitude),
        Number(data.longitude ?? existing.longitude)
      );
      if (!coordCheck.ok) {
        return { success: false, error: coordCheck.error };
      }
      nextLat = coordCheck.lat;
      nextLng = coordCheck.lng;
    }

    const short_name =
      data.short_name !== undefined
        ? sanitizeString(data.short_name || "", 60) || deriveShortVenueName(name)
        : existing.short_name;
    const notes =
      data.notes !== undefined
        ? sanitizeString(data.notes || "", 240) || null
        : existing.notes;
    const radius_meters =
      data.radius_meters !== undefined
        ? clampGeofenceRadiusMeters(data.radius_meters, existing.radius_meters)
        : existing.radius_meters;

    const updated = DataStore.updateVenue(id, {
      name,
      short_name,
      latitude: nextLat,
      longitude: nextLng,
      radius_meters,
      is_default: data.is_default,
      notes,
    });

    if (!updated) {
      return { success: false, error: "Could not update swimming place." };
    }

    const venues = DataStore.getSavedVenues();
    await SupabaseDB.syncVenues(venues);

    let updatedSessionsCount = 0;
    if (data.apply_to_upcoming) {
      // Update scheduled sessions linked to this venue or sharing the previous venue name
      const prevNameLower = existing.name.trim().toLowerCase();
      const matchingSessions = DataStore.getSessions({ status: "scheduled" }).filter(
        (s) =>
          !s.is_finalized &&
          (s.venue_id === id || s.location.trim().toLowerCase() === prevNameLower)
      );
      for (const sess of matchingSessions) {
        const u = DataStore.updateSession(sess.id, {
          location: updated.name,
          venue_id: updated.id,
          latitude: updated.latitude,
          longitude: updated.longitude,
          geofence_radius: updated.radius_meters,
        });
        if (u) {
          await SupabaseDB.upsertSession(u);
          updatedSessionsCount++;
        }
      }
    }

    revalidateVenuePaths();
    return { success: true, venue: updated, venues, updatedSessionsCount };
  } catch (err) {
    console.error("[updateVenueAction] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update swimming place.",
    };
  }
}

export async function setDefaultVenueAction(
  id: string,
  applyToUpcoming = false
): Promise<{
  success: boolean;
  venue?: PoolVenue;
  venues?: PoolVenue[];
  updatedSessionsCount?: number;
  error?: string;
}> {
  try {
    await requireAdminSession();
    await DataStore.syncFromSupabase();

    const venue = DataStore.setDefaultVenue(id);
    if (!venue) {
      return { success: false, error: "Swimming place not found." };
    }

    const venues = DataStore.getSavedVenues();
    await SupabaseDB.syncVenues(venues);

    let updatedSessionsCount = 0;
    if (applyToUpcoming) {
      updatedSessionsCount = await applyVenueToUpcomingScheduledSessions(venue);
    }

    revalidateVenuePaths();
    return { success: true, venue, venues, updatedSessionsCount };
  } catch (err) {
    console.error("[setDefaultVenueAction] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to set default pool.",
    };
  }
}

export async function deleteVenueAction(id: string): Promise<{
  success: boolean;
  venues?: PoolVenue[];
  error?: string;
}> {
  try {
    await requireAdminSession();
    await DataStore.syncFromSupabase();

    const res = DataStore.deleteVenue(id);
    if (!res.deleted) {
      return { success: false, error: res.error || "Failed to delete swimming place." };
    }

    const venues = DataStore.getSavedVenues();
    await SupabaseDB.syncVenues(venues, id);

    revalidateVenuePaths();
    return { success: true, venues };
  } catch (err) {
    console.error("[deleteVenueAction] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete swimming place.",
    };
  }
}
