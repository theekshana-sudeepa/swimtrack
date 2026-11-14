import { getSupabaseAdminClient } from "./supabase-client";
import { DataStore } from "./data-store";
import {
  Swimmer,
  SwimSession,
  AttendanceRecord,
  ReminderDelivery,
  AppSetting,
  SessionSeries,
} from "@/types/database";

export const SupabaseDB = {
  isConfigured(): boolean {
    return !!getSupabaseAdminClient();
  },

  /**
   * Synchronizes the in-memory DataStore cache with live Supabase Postgres tables.
   * Runs in parallel across all core tables.
   */
  async syncStoreFromSupabase(): Promise<boolean> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return false;

    try {
      const [swimmersRes, sessionsRes, attendanceRes, settingsRes, remindersRes, seriesRes] =
        await Promise.all([
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
                  opt_out_token: (pref.opt_out_token as string) || `token_${row.id}`,
                  opted_out_at: (pref.opted_out_at as string) || null,
                }
              : null,
          };
        });

        DataStore.hydrateSwimmers(mappedSwimmers);
      }

      // 2. Swim Sessions
      if (sessionsRes.data && sessionsRes.data.length > 0) {
        const mappedSessions: SwimSession[] = sessionsRes.data.map((row: Record<string, unknown>) => ({
          id: row.id as string,
          series_id: (row.series_id as string) || null,
          title: row.title as string,
          date: row.date as string,
          start_time: row.start_time as string,
          end_time: row.end_time as string,
          location: row.location as string,
          latitude: row.latitude != null ? Number(row.latitude) : null,
          longitude: row.longitude != null ? Number(row.longitude) : null,
          geofence_radius: row.geofence_radius != null ? Number(row.geofence_radius) : 30,
          notes: (row.notes as string) || null,
          status: (row.status as "scheduled" | "completed" | "cancelled") || "scheduled",
          is_finalized: !!row.is_finalized,
          finalized_at: (row.finalized_at as string) || null,
          finalized_by: (row.finalized_by as string) || null,
          created_at: row.created_at as string | undefined,
          updated_at: row.updated_at as string | undefined,
        }));
        DataStore.hydrateSessions(mappedSessions);
      }

      // 3. Attendance Records
      if (attendanceRes.data && attendanceRes.data.length > 0) {
        DataStore.hydrateAttendance(attendanceRes.data as AttendanceRecord[]);
      }

      // 4. App Settings
      if (settingsRes.data && settingsRes.data.length > 0) {
        const settingsMap: Record<string, AppSetting> = {};
        for (const row of settingsRes.data) {
          settingsMap[row.key] = row as AppSetting;
        }
        DataStore.hydrateSettings(settingsMap);
      }

      // 5. Reminders
      if (remindersRes.data && remindersRes.data.length > 0) {
        DataStore.hydrateReminders(remindersRes.data as ReminderDelivery[]);
      }

      // 6. Session Series
      if (seriesRes.data && seriesRes.data.length > 0) {
        DataStore.hydrateSeries(seriesRes.data as SessionSeries[]);
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
    changeReason?: string
  ): Promise<void> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return;
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
            if (record.checkin_method) geoPayload.checkin_method = record.checkin_method;
            if (record.checkin_distance != null) geoPayload.checkin_distance = record.checkin_distance;
            if (record.checkin_accuracy != null) geoPayload.checkin_accuracy = record.checkin_accuracy;

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
        old_status: "not_marked",
        new_status: record.status,
        change_reason: changeReason || record.notes || "Attendance status marked",
        actor_id: isValidUuid(actorId) ? actorId : null,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[SupabaseDB] Error upserting attendance:", err);
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
  ): Promise<void> {
    const supabase = getSupabaseAdminClient();
    if (!supabase || records.length === 0) return;
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
    } catch (err) {
      console.error("[SupabaseDB] Error bulk upserting attendance:", err);
    }
  },

  /**
   * Upserts a swim session.
   */
  async upsertSession(session: SwimSession): Promise<void> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return;
    try {
      const isValidUuid = (val?: string | null) =>
        typeof val === "string" &&
        val.length === 36 &&
        val !== "00000000-0000-0000-0000-000000000000";

      const payload: Record<string, unknown> = {
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
        payload.series_id = session.series_id;
      }
      if (session.latitude != null) payload.latitude = session.latitude;
      if (session.longitude != null) payload.longitude = session.longitude;
      if (session.geofence_radius != null) payload.geofence_radius = session.geofence_radius;

      if (session.finalized_at) {
        payload.finalized_at = session.finalized_at;
      }
      if (isValidUuid(session.finalized_by)) {
        payload.finalized_by = session.finalized_by;
      }

      const { error } = await supabase.from("swim_sessions").upsert(payload);
      if (error) {
        console.error("[SupabaseDB] Error upserting session:", error);
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
};

