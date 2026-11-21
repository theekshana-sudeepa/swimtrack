import { getSupabaseAdminClient } from "./supabase-client";
import { DataStore } from "./data-store";
import {
  DEFAULT_GEOFENCE_RADIUS_METERS,
  clampGeofenceRadiusMeters,
  matchKnownVenueByName,
} from "./geo-fence";
import {
  Swimmer,
  SwimSession,
  AttendanceRecord,
  AttendanceStatus,
  ReminderDelivery,
  AppSetting,
  SessionSeries,
  PoolVenue,
  SquadMemory,
  SquadMemoryPhoto,
} from "@/types/database";

/** Maps a swim_sessions row to the app model (shared by full sync and targeted refresh). */
function mapSessionRow(row: Record<string, unknown>): SwimSession {
  const id = row.id as string;
  const location = row.location as string;
  const override = DataStore.getSessionGeofenceOverride(id);
  const savedVenues = DataStore.getSavedVenues();
  const venueId = (row.venue_id as string) || override?.venue_id || null;
  const matchedById = venueId ? savedVenues.find((v) => v.id === venueId) || null : null;
  const matchedVenue = matchedById
    ? {
        name: matchedById.name,
        latitude: matchedById.latitude,
        longitude: matchedById.longitude,
        radiusMeters: matchedById.radius_meters,
      }
    : matchKnownVenueByName(location, savedVenues);

  const latitude =
    row.latitude != null
      ? Number(row.latitude)
      : override?.latitude != null
      ? Number(override.latitude)
      : matchedVenue
      ? matchedVenue.latitude
      : null;

  const longitude =
    row.longitude != null
      ? Number(row.longitude)
      : override?.longitude != null
      ? Number(override.longitude)
      : matchedVenue
      ? matchedVenue.longitude
      : null;

  const geofence_radius =
    row.geofence_radius != null
      ? clampGeofenceRadiusMeters(Number(row.geofence_radius))
      : override?.geofence_radius != null
      ? clampGeofenceRadiusMeters(Number(override.geofence_radius))
      : matchedVenue
      ? matchedVenue.radiusMeters
      : DEFAULT_GEOFENCE_RADIUS_METERS;

  return {
    id,
    series_id: (row.series_id as string) || null,
    venue_id: venueId,
    title: row.title as string,
    date: row.date as string,
    start_time: row.start_time as string,
    end_time: row.end_time as string,
    location,
    latitude,
    longitude,
    geofence_radius,
    notes: (row.notes as string) || null,
    status: (row.status as "scheduled" | "completed" | "cancelled") || "scheduled",
    is_finalized: !!row.is_finalized,
    finalized_at: (row.finalized_at as string) || null,
    finalized_by: (row.finalized_by as string) || null,
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

let lastSyncAt = 0;
let inflightSync: Promise<boolean> | null = null;

export const SupabaseDB = {
  isConfigured(): boolean {
    return !!getSupabaseAdminClient();
  },

  /**
   * Synchronizes the in-memory DataStore cache with live Supabase Postgres tables.
   * Runs in parallel across all core tables.
   */
  async syncStoreFromSupabase(options?: { maxAgeMs?: number }): Promise<boolean> {
    const maxAgeMs = options?.maxAgeMs ?? 0;
    if (maxAgeMs > 0) {
      // Fresh-enough snapshot: reuse it (high-traffic swimmer paths)
      if (lastSyncAt > 0 && Date.now() - lastSyncAt < maxAgeMs) return true;
      // Collapse concurrent callers into a single fetch
      if (inflightSync) return inflightSync;
      inflightSync = SupabaseDB.fetchAndHydrateStore()
        .then((ok) => {
          if (ok) lastSyncAt = Date.now();
          return ok;
        })
        .finally(() => {
          inflightSync = null;
        });
      return inflightSync;
    }

    const ok = await SupabaseDB.fetchAndHydrateStore();
    if (ok) lastSyncAt = Date.now();
    return ok;
  },

  /**
   * Targeted refresh of the two rows a swimmer action depends on (session + own attendance row),
   * so decisions are made on current data without reloading every table.
   * Returns false when the database could not be read.
   */
  async refreshSessionAndAttendance(sessionId: string, swimmerId: string): Promise<boolean> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return true; // in-memory / demo mode: memory is the source of truth

    try {
      const [sessionRes, attendanceRes] = await Promise.all([
        supabase.from("swim_sessions").select("*").eq("id", sessionId).maybeSingle(),
        supabase
          .from("attendance")
          .select("*")
          .eq("session_id", sessionId)
          .eq("swimmer_id", swimmerId)
          .maybeSingle(),
      ]);
      if (sessionRes.error || attendanceRes.error) {
        console.warn("[SupabaseDB] Targeted refresh failed:", sessionRes.error || attendanceRes.error);
        return false;
      }
      if (sessionRes.data) DataStore.upsertSessionRecord(mapSessionRow(sessionRes.data));
      if (attendanceRes.data) {
        DataStore.upsertAttendanceRecord(attendanceRes.data as AttendanceRecord);
      }
      return true;
    } catch (err) {
      console.warn("[SupabaseDB] Targeted refresh failed:", err);
      return false;
    }
  },

  /** Persists a (re)minted swimmer pass token. Returns false if the write failed. */
  async persistSwimmerToken(
    swimmerId: string,
    prefId: string,
    token: string,
    emailRemindersEnabled: boolean
  ): Promise<boolean> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return true;
    try {
      const { error } = await supabase.from("reminder_preferences").upsert(
        {
          id: prefId,
          swimmer_id: swimmerId,
          email_reminders_enabled: emailRemindersEnabled,
          opt_out_token: token,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "swimmer_id" }
      );
      if (error) {
        console.error("[SupabaseDB] Error persisting swimmer token:", error);
        return false;
      }
      return true;
    } catch (err) {
      console.error("[SupabaseDB] Error persisting swimmer token:", err);
      return false;
    }
  },

  /** Full read of every core table into the in-memory store. */
  async fetchAndHydrateStore(): Promise<boolean> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return false;

    try {
      const [
        swimmersRes,
        sessionsRes,
        attendanceRes,
        settingsRes,
        remindersRes,
        seriesRes,
        venuesRes,
        memoriesRes,
      ] = await Promise.all([
        supabase
          .from("swimmers")
          .select("*, reminder_preferences(*)")
          .order("created_at", { ascending: false }),
        supabase
          .from("swim_sessions")
          .select("*")
          .order("date", { ascending: false }),
        supabase.from("attendance").select("*"),
        supabase.from("app_settings").select("*"),
        supabase
          .from("reminder_deliveries")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("session_series")
          .select("*")
          .order("created_at", { ascending: false }),
        Promise.resolve(
          supabase
            .from("pool_venues")
            .select("*")
            .order("is_default", { ascending: false })
            .order("created_at", { ascending: true })
        ).catch(() => ({ data: null, error: null })),
        Promise.resolve(
          supabase
            .from("squad_memories")
            .select("*, squad_memory_photos(*)")
            .order("memory_date", { ascending: false })
        ).catch(() => ({ data: null, error: null })),
      ]);

      // 1. Swimmers
      if (swimmersRes.data && swimmersRes.data.length > 0) {
        const mappedSwimmers: Swimmer[] = swimmersRes.data.map((row: Record<string, unknown>) => {
          const rawPref = row.reminder_preferences;
          const pref = Array.isArray(rawPref)
            ? (rawPref[0] as Record<string, unknown> | undefined)
            : (rawPref as Record<string, unknown> | undefined);

          return {
            id: row.id as string,
            full_name: row.full_name as string,
            nickname: (row.nickname as string) || null,
            email: (row.email as string) || null,
            phone: (row.phone as string) || null,
            join_date: (row.join_date as string) || new Date().toISOString().split("T")[0],
            status: (row.status as "active" | "archived") || "active",
            notes: (row.notes as string) || null,
            avatar_color: (row.avatar_color as string) || "ocean",
            created_at: row.created_at as string | undefined,
            updated_at: row.updated_at as string | undefined,
            reminder_preferences: pref
              ? {
                  id: (pref.id as string) || `pref-${row.id}`,
                  swimmer_id: row.id as string,
                  email_reminders_enabled: pref.email_reminders_enabled !== false,
                  opt_out_token: (pref.opt_out_token as string) || null,
                  opted_out_at: (pref.opted_out_at as string) || null,
                }
              : null,
          };
        });

        DataStore.hydrateSwimmers(mappedSwimmers);
      }

      // 2. App Settings (hydrate before venues & sessions so session_geofences & saved_venues are available)
      if (settingsRes.data && settingsRes.data.length > 0) {
        const settingsMap: Record<string, AppSetting> = {};
        for (const row of settingsRes.data) {
          settingsMap[row.key] = row as AppSetting;
        }
        DataStore.hydrateSettings(settingsMap);
      }

      // 2b. Saved Swimming Places (prefer dedicated pool_venues table, fallback to app_settings.saved_venues)
      const venueRows =
        !venuesRes.error && Array.isArray(venuesRes.data) && venuesRes.data.length > 0
          ? (venuesRes.data as PoolVenue[])
          : null;
      if (venueRows) {
        DataStore.hydrateVenues(venueRows);
      } else {
        const settingsVenues = (
          DataStore.getAppSettings()["saved_venues"]?.value as
            | { venues?: PoolVenue[] }
            | undefined
        )?.venues;
        if (Array.isArray(settingsVenues) && settingsVenues.length > 0) {
          DataStore.hydrateVenues(settingsVenues);
        } else {
          // If coach previously configured a custom default_pool in general settings, preserve it as default venue
          const general = DataStore.getAppSettings()["general"]?.value as
            | Record<string, unknown>
            | undefined;
          if (
            general &&
            typeof general.default_pool === "string" &&
            general.default_pool.trim() &&
            typeof general.default_pool_latitude === "number" &&
            typeof general.default_pool_longitude === "number"
          ) {
            DataStore.ensureVenueSaved({
              name: general.default_pool,
              latitude: general.default_pool_latitude,
              longitude: general.default_pool_longitude,
              radius_meters:
                typeof general.default_pool_radius === "number"
                  ? general.default_pool_radius
                  : DEFAULT_GEOFENCE_RADIUS_METERS,
              is_default: true,
            });
          }
        }
      }

      // 3. Swim Sessions
      if (sessionsRes.data && sessionsRes.data.length > 0) {
        const mappedSessions: SwimSession[] = sessionsRes.data.map((row: Record<string, unknown>) =>
          mapSessionRow(row)
        );
        DataStore.hydrateSessions(mappedSessions);
      }

      // 4. Attendance Records
      if (attendanceRes.data && attendanceRes.data.length > 0) {
        DataStore.hydrateAttendance(attendanceRes.data as AttendanceRecord[]);
      }

      // 5. Reminders
      if (remindersRes.data && remindersRes.data.length > 0) {
        DataStore.hydrateReminders(remindersRes.data as ReminderDelivery[]);
      }

      // 6. Session Series
      if (seriesRes.data && seriesRes.data.length > 0) {
        DataStore.hydrateSeries(seriesRes.data as SessionSeries[]);
      }

      // 7. Squad Memories (fault-tolerant if migration hasn't been applied yet)
      if (!memoriesRes.error && Array.isArray(memoriesRes.data)) {
        const mappedMemories: SquadMemory[] = memoriesRes.data.map(
          (row: Record<string, unknown>) => {
            const rawPhotos = Array.isArray(row.squad_memory_photos)
              ? (row.squad_memory_photos as Record<string, unknown>[])
              : [];
            const photos: SquadMemoryPhoto[] = rawPhotos
              .map((p) => ({
                id: p.id as string,
                memory_id: p.memory_id as string,
                slot: Math.min(3, Math.max(1, Number(p.slot) || 1)) as 1 | 2 | 3,
                storage_path: p.storage_path as string,
                mime_type:
                  (p.mime_type as "image/webp" | "image/jpeg" | "image/png") || "image/webp",
                size_bytes: Number(p.size_bytes) || 0,
                width: p.width != null ? Number(p.width) : null,
                height: p.height != null ? Number(p.height) : null,
                caption: (p.caption as string) || null,
                uploaded_by_name: (p.uploaded_by_name as string) || "Squad Coach",
                uploaded_by_swimmer_id: (p.uploaded_by_swimmer_id as string) || null,
                uploaded_by_role:
                  p.uploaded_by_role === "swimmer" ? ("swimmer" as const) : ("admin" as const),
                created_at: (p.created_at as string) || new Date().toISOString(),
              }))
              .sort((a, b) => a.slot - b.slot);

            return {
              id: row.id as string,
              memory_date: row.memory_date as string,
              session_id: (row.session_id as string) || null,
              title: (row.title as string) || "End-of-Day Squad Memory",
              caption: (row.caption as string) || null,
              location: (row.location as string) || null,
              created_by_name: (row.created_by_name as string) || "Squad Coach",
              created_by_swimmer_id: (row.created_by_swimmer_id as string) || null,
              created_at: (row.created_at as string) || new Date().toISOString(),
              updated_at: (row.updated_at as string) || undefined,
              photos,
            };
          }
        );
        DataStore.hydrateMemories(mappedMemories);
      }

      return true;
    } catch (err) {
      console.warn("[SupabaseDB] Failed to synchronize state:", err);
      return false;
    }
  },

  /**
   * Persists a newly created or joined swimmer into Supabase.
   * Auto-enrolls the swimmer into scheduled sessions in the attendance table.
   */
  async insertSwimmer(swimmer: Swimmer): Promise<void> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return;

    try {
      // 1. Insert into swimmers table
      await supabase.from("swimmers").upsert({
        id: swimmer.id,
        full_name: swimmer.full_name,
        nickname: swimmer.nickname || null,
        email: swimmer.email || null,
        phone: swimmer.phone || null,
        join_date: swimmer.join_date,
        status: swimmer.status,
        notes: swimmer.notes || null,
        avatar_color: swimmer.avatar_color || "ocean",
        updated_at: new Date().toISOString(),
      });

      // 2. Insert reminder preferences
      if (swimmer.reminder_preferences) {
        await supabase.from("reminder_preferences").upsert(
          {
            id: swimmer.reminder_preferences.id,
            swimmer_id: swimmer.id,
            email_reminders_enabled: swimmer.reminder_preferences.email_reminders_enabled,
            opt_out_token: swimmer.reminder_preferences.opt_out_token,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "swimmer_id" }
        );
      }

      // 3. Auto-enroll in all active scheduled sessions
      const { data: activeSessions } = await supabase
        .from("swim_sessions")
        .select("id")
        .eq("status", "scheduled");

      if (activeSessions && activeSessions.length > 0) {
        const attendanceRows = activeSessions.map((sess) => ({
          session_id: sess.id,
          swimmer_id: swimmer.id,
          status: "not_marked",
        }));
        await supabase.from("attendance").upsert(attendanceRows, {
          onConflict: "session_id,swimmer_id",
        });
      }
    } catch (err) {
      console.error("[SupabaseDB] Error inserting swimmer:", err);
    }
  },

  /**
   * Updates an existing swimmer's details in Supabase.
   */
  async updateSwimmer(
    id: string,
    data: {
      full_name?: string;
      nickname?: string;
      email?: string;
      phone?: string;
      notes?: string;
      avatar_color?: string;
      status?: "active" | "archived";
      email_reminders_enabled?: boolean;
    }
  ): Promise<void> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return;

    try {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (data.full_name !== undefined) updates.full_name = data.full_name;
      if (data.nickname !== undefined) updates.nickname = data.nickname || null;
      if (data.email !== undefined) updates.email = data.email || null;
      if (data.phone !== undefined) updates.phone = data.phone || null;
      if (data.notes !== undefined) updates.notes = data.notes || null;
      if (data.avatar_color !== undefined) updates.avatar_color = data.avatar_color;
      if (data.status !== undefined) updates.status = data.status;

      await supabase.from("swimmers").update(updates).eq("id", id);

      if (data.email_reminders_enabled !== undefined) {
        await supabase
          .from("reminder_preferences")
          .update({
            email_reminders_enabled: data.email_reminders_enabled,
            updated_at: new Date().toISOString(),
          })
          .eq("swimmer_id", id);
      }
    } catch (err) {
      console.error("[SupabaseDB] Error updating swimmer:", err);
    }
  },

  /**
   * Archives a swimmer.
   */
  async archiveSwimmer(id: string): Promise<void> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return;
    try {
      await supabase
        .from("swimmers")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .eq("id", id);
    } catch (err) {
      console.error("[SupabaseDB] Error archiving swimmer:", err);
    }
  },

  /**
   * Restores an archived swimmer to active status.
   */
  async restoreSwimmer(id: string): Promise<void> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return;
    try {
      await supabase
        .from("swimmers")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", id);
    } catch (err) {
      console.error("[SupabaseDB] Error restoring swimmer:", err);
    }
  },

  /**
   * Upserts an attendance record and writes an audit log trail.
   */
  /**
   * Upserts an attendance record into Supabase PostgreSQL.
   * Backward-compatible with base schema even if geofence migration hasn't been run yet.
   */
  async upsertAttendance(
    record: AttendanceRecord,
    actorId?: string,
    changeReason?: string,
    oldStatus: AttendanceStatus = "not_marked"
  ): Promise<boolean> {
    const supabase = getSupabaseAdminClient();
    // No database configured (demo / in-memory mode): nothing to persist, not a failure.
    if (!supabase) return true;
    try {
      const isValidUuid = (val?: string | null) =>
        typeof val === "string" &&
        val.length === 36 &&
        val !== "00000000-0000-0000-0000-000000000000";

      // 1. Guaranteed Core Payload (Strictly verified columns in public.attendance)
      const basePayload: Record<string, unknown> = {
        session_id: record.session_id,
        swimmer_id: record.swimmer_id,
        status: record.status,
        notes: record.notes || null,
        marked_at: record.marked_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (isValidUuid(actorId)) {
        basePayload.marked_by = actorId;
      }
      if (isValidUuid(record.id)) {
        basePayload.id = record.id;
      }

      // Upsert base payload matching (session_id, swimmer_id) unique constraint
      const { error: baseError } = await supabase
        .from("attendance")
        .upsert(basePayload, { onConflict: "session_id,swimmer_id" });

      if (baseError) {
        console.error("[SupabaseDB] Error upserting attendance base payload:", baseError);
        return false;
      } else {
        // 2. Safely attempt updating geofence columns if present on the record
        // This is non-fatal so if the migration isn't applied yet, standard attendance still succeeds 100%!
        if (
          record.checkin_method ||
          (record.checkin_distance !== undefined && record.checkin_distance !== null) ||
          (record.checkin_accuracy !== undefined && record.checkin_accuracy !== null)
        ) {
          try {
            const geoPayload: Record<string, unknown> = {};
            if (record.checkin_method) {
              geoPayload.checkin_method = record.checkin_method;
              // Always write distance/accuracy with the method so stale GPS evidence is cleared
              geoPayload.checkin_distance = record.checkin_distance ?? null;
              geoPayload.checkin_accuracy = record.checkin_accuracy ?? null;
            }

            await supabase
              .from("attendance")
              .update(geoPayload)
              .eq("session_id", record.session_id)
              .eq("swimmer_id", record.swimmer_id);
          } catch {
            // Geofence columns do not exist yet in live Supabase - safe to ignore
          }
        }
      }

      // 3. Private Audit Trail Log
      await supabase.from("attendance_audit_log").insert({
        session_id: record.session_id,
        swimmer_id: record.swimmer_id,
        old_status: oldStatus,
        new_status: record.status,
        change_reason: changeReason || record.notes || "Attendance status marked",
        actor_id: isValidUuid(actorId) ? actorId : null,
        created_at: new Date().toISOString(),
      });
      return true;
    } catch (err) {
      console.error("[SupabaseDB] Error upserting attendance:", err);
      return false;
    }
  },

  /**
   * Bulk upserts attendance records in a single batch database transaction.
   * Prevents N+1 HTTP waterfalls during bulk actions.
   */
  async bulkUpsertAttendance(
    records: AttendanceRecord[],
    actorId?: string,
    changeReason?: string
  ): Promise<boolean> {
    const supabase = getSupabaseAdminClient();
    if (!supabase || records.length === 0) return true;
    try {
      const isValidUuid = (val?: string | null) =>
        typeof val === "string" &&
        val.length === 36 &&
        val !== "00000000-0000-0000-0000-000000000000";

      const now = new Date().toISOString();
      const basePayloads = records.map((record) => {
        const payload: Record<string, unknown> = {
          session_id: record.session_id,
          swimmer_id: record.swimmer_id,
          status: record.status,
          notes: record.notes || null,
          marked_at: record.marked_at || now,
          updated_at: now,
        };
        if (isValidUuid(actorId)) {
          payload.marked_by = actorId;
        }
        if (isValidUuid(record.id)) {
          payload.id = record.id;
        }
        if (record.checkin_method) {
          payload.checkin_method = record.checkin_method;
        }
        if (record.checkin_distance != null) {
          payload.checkin_distance = record.checkin_distance;
        }
        if (record.checkin_accuracy != null) {
          payload.checkin_accuracy = record.checkin_accuracy;
        }
        return payload;
      });

      const { error } = await supabase
        .from("attendance")
        .upsert(basePayloads, { onConflict: "session_id,swimmer_id" });

      if (error) {
        console.error("[SupabaseDB] Error in bulkUpsertAttendance:", error);
        return false;
      }

      // Batch insert audit log entries
      const auditRows = records.map((r) => ({
        session_id: r.session_id,
        swimmer_id: r.swimmer_id,
        old_status: "not_marked",
        new_status: r.status,
        change_reason: changeReason || r.notes || "Bulk attendance marked",
        actor_id: isValidUuid(actorId) ? actorId : null,
        created_at: now,
      }));

      await supabase.from("attendance_audit_log").insert(auditRows);
      return true;
    } catch (err) {
      console.error("[SupabaseDB] Error bulk upserting attendance:", err);
      return false;
    }
  },

  /**
   * Upserts a swim session.
   * Fault-tolerant: writes base columns first, then attempts geofence columns on swim_sessions
   * and also persists coordinates in app_settings (`session_geofences`) so custom pool pins
   * always persist even if the geofence SQL migration has not been applied yet.
   */
  async upsertSession(session: SwimSession): Promise<void> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return;
    try {
      const isValidUuid = (val?: string | null) =>
        typeof val === "string" &&
        val.length === 36 &&
        val !== "00000000-0000-0000-0000-000000000000";

      const basePayload: Record<string, unknown> = {
        id: session.id,
        title: session.title,
        date: session.date,
        start_time: session.start_time,
        end_time: session.end_time,
        location: session.location,
        notes: session.notes || null,
        status: session.status,
        is_finalized: !!session.is_finalized,
        updated_at: new Date().toISOString(),
      };

      if (isValidUuid(session.series_id)) {
        basePayload.series_id = session.series_id;
      }
      if (session.finalized_at) {
        basePayload.finalized_at = session.finalized_at;
      }
      if (isValidUuid(session.finalized_by)) {
        basePayload.finalized_by = session.finalized_by;
      }

      // 1. Upsert guaranteed base columns first so location text always persists
      const { error: baseError } = await supabase.from("swim_sessions").upsert(basePayload);
      if (baseError) {
        console.error("[SupabaseDB] Error upserting session base payload:", baseError);
      }

      // 2. Non-fatally update geofence coordinates, venue_id & clamped radius on swim_sessions
      const clampedRadius = clampGeofenceRadiusMeters(
        session.geofence_radius,
        DEFAULT_GEOFENCE_RADIUS_METERS
      );

      if (
        session.latitude != null ||
        session.longitude != null ||
        session.geofence_radius != null ||
        session.venue_id !== undefined
      ) {
        try {
          const geoPayload: Record<string, unknown> = {
            geofence_radius: clampedRadius,
          };
          if (session.latitude != null) geoPayload.latitude = session.latitude;
          if (session.longitude != null) geoPayload.longitude = session.longitude;

          await supabase.from("swim_sessions").update(geoPayload).eq("id", session.id);

          // Separately attempt venue_id in case pool_venues migration isn't applied yet
          if (session.venue_id !== undefined) {
            const validVenueId = isValidUuid(session.venue_id) ? session.venue_id : null;
            await supabase
              .from("swim_sessions")
              .update({ venue_id: validVenueId })
              .eq("id", session.id);
          }
        } catch {
          // Geofence/venue columns may not be migrated yet in live DB — handled by app_settings fallback below
        }
      }

      // 3. Persist in app_settings ("session_geofences") as a rock-solid fallback
      if (session.latitude != null && session.longitude != null) {
        DataStore.setSessionGeofenceOverride(session.id, {
          location: session.location,
          latitude: session.latitude,
          longitude: session.longitude,
          geofence_radius: clampedRadius,
          venue_id: session.venue_id ?? null,
        });
        const allSettings = DataStore.getAppSettings();
        const geoSetting = allSettings["session_geofences"];
        if (geoSetting && typeof geoSetting.value === "object" && geoSetting.value !== null) {
          await this.upsertAppSetting(
            "session_geofences",
            geoSetting.value as Record<string, unknown>
          );
        }
      }
    } catch (err) {
      console.error("[SupabaseDB] Error upserting session:", err);
    }
  },

  /**
   * Persists a recurring session series and all its generated sessions into Supabase.
   */
  async insertSeries(series: SessionSeries, generatedSessions: SwimSession[]): Promise<void> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return;

    try {
      // 1. Insert session series
      const seriesPayload: Record<string, unknown> = {
        id: series.id,
        title: series.title,
        location: series.location,
        recurrence_rule: series.recurrence_rule,
        day_of_week: series.day_of_week,
        start_time: series.start_time,
        end_time: series.end_time,
        start_date: series.start_date,
        active: series.active,
        updated_at: new Date().toISOString(),
      };
      if (series.end_date) {
        seriesPayload.end_date = series.end_date;
      }

      await supabase.from("session_series").upsert(seriesPayload);

      // 2. Batch upsert generated sessions
      for (const sess of generatedSessions) {
        await this.upsertSession(sess);
      }
    } catch (err) {
      console.error("[SupabaseDB] Error inserting session series:", err);
    }
  },

  /**
   * Deletes a session from Supabase.
   */
  async deleteSession(id: string): Promise<void> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return;
    try {
      const { error } = await supabase.from("swim_sessions").delete().eq("id", id);
      if (error) {
        console.error("[SupabaseDB] Error deleting session:", error);
      }
    } catch (err) {
      console.error("[SupabaseDB] Error deleting session:", err);
    }
  },

  /**
   * Persists an email reminder delivery event into Supabase reminder_deliveries.
   */
  async insertReminderDelivery(delivery: Partial<ReminderDelivery>): Promise<void> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return;
    try {
      const isValidUuid = (val?: string) =>
        typeof val === "string" &&
        val.length === 36 &&
        val !== "00000000-0000-0000-0000-000000000000";

      await supabase.from("reminder_deliveries").upsert(
        {
          claim_key: delivery.claim_key,
          session_id: isValidUuid(delivery.session_id) ? delivery.session_id : null,
          swimmer_id: isValidUuid(delivery.swimmer_id) ? delivery.swimmer_id : null,
          reminder_type: delivery.reminder_type || "manual",
          recipient_email: delivery.recipient_email,
          status: delivery.status || "sent",
          provider_message_id: delivery.provider_message_id || null,
          error_message: delivery.error_message || null,
          created_at: new Date().toISOString(),
        },
        { onConflict: "claim_key" }
      );
    } catch (err) {
      console.warn("[SupabaseDB] Error recording reminder delivery:", err);
    }
  },

  /**
   * Persists an application setting row into Supabase app_settings table.
   */
  async upsertAppSetting(key: string, value: Record<string, unknown>): Promise<void> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return;
    try {
      const { error } = await supabase.from("app_settings").upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        console.error("[SupabaseDB] Error upserting app setting:", error);
      }
    } catch (err) {
      console.error("[SupabaseDB] Error upserting app setting:", err);
    }
  },

  /**
   * Synchronizes all coach-saved swimming places into both `public.pool_venues` (if migrated)
   * and `app_settings["saved_venues"]` + `app_settings["general"]` (zero-downtime fallback).
   */
  async syncVenues(venues: PoolVenue[], deletedId?: string): Promise<void> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return;

    const now = new Date().toISOString();

    // 1. Always persist durable JSON snapshot in app_settings
    await this.upsertAppSetting("saved_venues", { venues });

    // Keep general.default_pool synchronized with the default venue
    const defaultVenue = venues.find((v) => v.is_default) || venues[0];
    if (defaultVenue) {
      const generalVal = (DataStore.getAppSettings()["general"]?.value || {}) as Record<
        string,
        unknown
      >;
      await this.upsertAppSetting("general", {
        ...generalVal,
        default_pool: defaultVenue.name,
        default_pool_latitude: defaultVenue.latitude,
        default_pool_longitude: defaultVenue.longitude,
        default_pool_radius: defaultVenue.radius_meters,
      });
    }

    // 2. Non-fatally mirror into dedicated `public.pool_venues` relational table when migrated
    try {
      const isValidUuid = (val?: string | null) =>
        typeof val === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

      if (deletedId && isValidUuid(deletedId)) {
        await supabase.from("pool_venues").delete().eq("id", deletedId);
      }

      // Clear existing is_default flags first so the partial unique index never collides
      await supabase
        .from("pool_venues")
        .update({ is_default: false, updated_at: now })
        .eq("is_default", true);

      const rows = venues
        .filter((v) => isValidUuid(v.id))
        .map((v) => ({
          id: v.id,
          name: v.name,
          short_name: v.short_name,
          latitude: v.latitude,
          longitude: v.longitude,
          radius_meters: clampGeofenceRadiusMeters(v.radius_meters),
          is_default: Boolean(v.is_default),
          notes: v.notes || null,
          updated_at: now,
        }));

      if (rows.length > 0) {
        await supabase.from("pool_venues").upsert(rows, { onConflict: "id" });
      }
    } catch {
      // `pool_venues` migration not applied yet — app_settings fallback above guarantees persistence
    }
  },
};

