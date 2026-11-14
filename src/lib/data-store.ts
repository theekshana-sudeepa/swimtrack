import {
  Swimmer,
  SwimSession,
  AttendanceRecord,
  SessionSeries,
  AttendanceStatus,
  SessionStatus,
  AttendanceAuditLog,
  ReminderDelivery,
  AppSetting,
  SquadMessage,
} from "@/types/database";
import {
  INITIAL_SWIMMERS,
  INITIAL_SESSIONS,
  INITIAL_ATTENDANCE,
  INITIAL_SERIES,
  INITIAL_AUDIT_LOGS,
  INITIAL_REMINDER_DELIVERIES,
} from "./demo-data";
import {
  calculateAttendanceRate,
  calculateStreaks,
  parseLateInfo,
  calculateMinutesLate,
  isSessionUpcomingOrActive,
} from "./attendance-calculator";
import { generateSwimmerToken, isStrongSwimmerToken, timingSafeMatch } from "./security";

/** Coach-configurable attendance rules (Settings -> General). */
export interface AttendancePolicy {
  /** Minutes after start before a GPS check-in counts as late. */
  lateThresholdMinutes: number;
  /** Swimmers can self-report an excuse only until this many minutes before start. */
  excuseCutoffMinutes: number;
}
export const DEFAULT_ATTENDANCE_POLICY: AttendancePolicy = {
  lateThresholdMinutes: 10,
  excuseCutoffMinutes: 60,
};

// In-memory persistent state (persists across requests during server runtime)
interface StoreState {
  swimmers: Swimmer[];
  sessions: SwimSession[];
  series: SessionSeries[];
  attendance: AttendanceRecord[];
  auditLogs: AttendanceAuditLog[];
  reminders: ReminderDelivery[];
  messages: SquadMessage[];
  settings: Record<string, AppSetting>;
}

// Global singleton in Node global scope to prevent reset during dev HMR
const globalForStore = globalThis as unknown as {
  __swimtrack_store?: StoreState;
};

function getInitialStore(forceDemo = false): StoreState {
  const isCleanSlate =
    !forceDemo &&
    (process.env.CLEAR_DEMO_DATA === "true" ||
      process.env.START_FRESH === "true" ||
      process.env.NEXT_PUBLIC_START_FRESH === "true");

  return {
    swimmers: isCleanSlate ? [] : JSON.parse(JSON.stringify(INITIAL_SWIMMERS)),
    sessions: isCleanSlate ? [] : JSON.parse(JSON.stringify(INITIAL_SESSIONS)),
    series: isCleanSlate ? [] : JSON.parse(JSON.stringify(INITIAL_SERIES)),
    attendance: isCleanSlate ? [] : JSON.parse(JSON.stringify(INITIAL_ATTENDANCE)),
    auditLogs: isCleanSlate ? [] : JSON.parse(JSON.stringify(INITIAL_AUDIT_LOGS)),
    reminders: isCleanSlate ? [] : JSON.parse(JSON.stringify(INITIAL_REMINDER_DELIVERIES)),
    messages: [
      {
        id: "msg-welcome-admin",
        author_name: "Squad Coach",
        content: "Welcome to SwimTrack! Use this chalkboard for squad updates, pool notes, and motivation 🏊🌊",
        created_at: new Date().toISOString(),
        is_admin: true,
      },
    ],
    settings: {
      general: {
        key: "general",
        value: {
          group_name: "SwimTrack Club",
          default_pool: "Bandaranayake College Swimming Pool Complex, Gampaha",
          default_duration_minutes: 105,
          timezone: "Asia/Colombo",
          admin_email: "theekshanasudeepa4@gmail.com",
        },
      },
      reminders: {
        key: "reminders",
        value: {
          auto_reminders_enabled: true,
          reminder_hours_before: 24,
          default_message:
            "Friendly reminder for our upcoming swimming session. Don't forget your goggles, cap, and hydration!",
        },
      },
      swimmer_pins: {
        key: "swimmer_pins",
        value: {},
        updated_at: new Date().toISOString(),
      },
    },
  };
}

const store: StoreState = globalForStore.__swimtrack_store || getInitialStore();
if (process.env.NODE_ENV !== "production") {
  globalForStore.__swimtrack_store = store;
}

export const DataStore = {
  resetToDemo(): void {
    const fresh = getInitialStore(true);
    store.swimmers = fresh.swimmers;
    store.sessions = fresh.sessions;
    store.series = fresh.series;
    store.attendance = fresh.attendance;
    store.auditLogs = fresh.auditLogs;
    store.reminders = fresh.reminders;
    store.messages = fresh.messages;
    store.settings = fresh.settings;
  },

  clearAllData(): void {
    store.swimmers = [];
    store.sessions = [];
    store.series = [];
    store.attendance = [];
    store.auditLogs = [];
    store.reminders = [];
    store.messages = [];
  },

  // ---------------------------------------------------------------------------
  // Supabase Hydration & Synchronization
  // ---------------------------------------------------------------------------
  /**
   * Pulls the latest state from Supabase. Pass `maxAgeMs` on high-traffic swimmer paths to reuse
   * a recent snapshot (concurrent callers share one fetch) instead of reloading every table.
   */
  async syncFromSupabase(options?: { maxAgeMs?: number }): Promise<boolean> {
    const { SupabaseDB } = await import("./supabase-db");
    return SupabaseDB.syncStoreFromSupabase(options);
  },

  /** Merges one freshly-read session row into memory (targeted refresh). */
  upsertSessionRecord(session: SwimSession): void {
    const idx = store.sessions.findIndex((s) => s.id === session.id);
    if (idx === -1) store.sessions.push(session);
    else store.sessions[idx] = { ...store.sessions[idx], ...session };
  },

  /** Merges one freshly-read attendance row into memory (targeted refresh). */
  upsertAttendanceRecord(record: AttendanceRecord): void {
    const idx = store.attendance.findIndex(
      (a) => a.session_id === record.session_id && a.swimmer_id === record.swimmer_id
    );
    if (idx === -1) store.attendance.push(record);
    else store.attendance[idx] = { ...store.attendance[idx], ...record };
  },

  /** Reads the coach-configurable attendance rules with safe clamping. */
  getAttendancePolicy(): AttendancePolicy {
    const general = (store.settings.general?.value || {}) as Record<string, unknown>;
    const num = (v: unknown, fallback: number, min: number, max: number) => {
      const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    };
    return {
      lateThresholdMinutes: num(
        general.late_threshold_minutes,
        DEFAULT_ATTENDANCE_POLICY.lateThresholdMinutes,
        0,
        120
      ),
      excuseCutoffMinutes: num(
        general.excuse_cutoff_minutes,
        DEFAULT_ATTENDANCE_POLICY.excuseCutoffMinutes,
        0,
        24 * 60
      ),
    };
  },

  hydrateSwimmers(swimmers: Swimmer[]): void {
    store.swimmers = swimmers;
  },

  hydrateSessions(sessions: SwimSession[]): void {
    store.sessions = sessions;
  },

  hydrateAttendance(records: AttendanceRecord[]): void {
    store.attendance = records;
  },

  hydrateSettings(settings: Record<string, AppSetting>): void {
    store.settings = { ...store.settings, ...settings };
  },

  hydrateReminders(reminders: ReminderDelivery[]): void {
    store.reminders = reminders;
  },

  hydrateSeries(series: SessionSeries[]): void {
    store.series = series;
  },

  // ---------------------------------------------------------------------------
  // Swimmers
  // ---------------------------------------------------------------------------
  getSwimmers(options?: { status?: "active" | "archived" | "all"; search?: string }): Swimmer[] {
    let result = [...store.swimmers];
    if (options?.status && options.status !== "all") {
      result = result.filter((s) => s.status === options.status);
    }
    if (options?.search) {
      const q = options.search.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          (s.nickname && s.nickname.toLowerCase().includes(q)) ||
          (s.email && s.email.toLowerCase().includes(q))
      );
    }

    // Attach computed stats based on COMPLETED sessions held by the squad
    const completedSessions = store.sessions
      .filter((s) => s.status === "completed" || s.is_finalized)
      .sort((a, b) => {
        const dateDiff = (a.date || "").localeCompare(b.date || "");
        if (dateDiff !== 0) return dateDiff;
        return (a.start_time || "").localeCompare(b.start_time || "");
      });

    return result.map((swimmer) => {
      // If completed sessions exist, evaluate attendance against all completed sessions held by the squad
      if (completedSessions.length > 0) {
        let present = 0;
        let late = 0;
        let absent = 0;
        let excused = 0;

        const datesWithStatus = completedSessions.map((sess) => {
          const record = store.attendance.find(
            (a) => a.session_id === sess.id && a.swimmer_id === swimmer.id
          );

          let status: AttendanceStatus = "absent";
          if (record) {
            if (record.status === "present") status = "present";
            else if (record.status === "late") status = "late";
            else if (record.status === "excused") status = "excused";
            else if (record.status === "absent") status = "absent";
            else status = "absent"; // "not_marked" in a completed session is an unexcused absence
          }

          if (status === "present") present++;
          else if (status === "late") late++;
          else if (status === "excused") excused++;
          else absent++;

          return {
            date: sess.date,
            status,
          };
        });

        const totalOpportunities = present + late + absent;
        const rate =
          totalOpportunities > 0
            ? Math.round(((present + late) / totalOpportunities) * 1000) / 10
            : 0;

        const streaks = calculateStreaks(datesWithStatus);

        return {
          ...swimmer,
          attendance_stats: {
            total: totalOpportunities,
            present,
            late,
            absent,
            excused,
            rate,
            currentStreak: streaks.currentStreak,
            longestStreak: streaks.longestStreak,
          },
        };
      }

      // Fallback if no completed sessions exist yet: compute from any marked records
      const swimmerRecords = store.attendance.filter(
        (a) => a.swimmer_id === swimmer.id
      );
      const calc = calculateAttendanceRate(swimmerRecords);

      // Streak calculation
      const datesWithStatus = swimmerRecords.map((r) => {
        const sess = store.sessions.find((s) => s.id === r.session_id);
        return {
          date: sess ? sess.date : "2026-01-01",
          status: r.status,
        };
      });
      const streaks = calculateStreaks(datesWithStatus);

      return {
        ...swimmer,
        attendance_stats: {
          total: calc.totalOpportunities,
          present: calc.present,
          late: calc.late,
          absent: calc.absent,
          excused: calc.excused,
          rate: calc.attendanceRate,
          currentStreak: streaks.currentStreak,
          longestStreak: streaks.longestStreak,
        },
      };
    });
  },

  getSwimmerById(id: string): Swimmer | null {
    const list = this.getSwimmers({ status: "all" });
    return list.find((s) => s.id === id) || null;
  },

  createSwimmer(data: {
    full_name: string;
    nickname?: string;
    email?: string;
    phone?: string;
    notes?: string;
    avatar_color?: string;
    email_reminders_enabled?: boolean;
  }): Swimmer {
    const newId = crypto.randomUUID();
    const prefId = crypto.randomUUID();
    const newSwimmer: Swimmer = {
      id: newId,
      full_name: data.full_name,
      nickname: data.nickname || null,
      email: data.email || null,
      phone: data.phone || null,
      join_date: new Date().toISOString().split("T")[0],
      status: "active",
      notes: data.notes || null,
      avatar_color: data.avatar_color || "ocean",
      reminder_preferences: {
        id: prefId,
        swimmer_id: newId,
        email_reminders_enabled: data.email_reminders_enabled ?? (data.email ? true : false),
        opt_out_token: generateSwimmerToken(),
      },
    };

    store.swimmers.push(newSwimmer);

    // Auto enroll in active upcoming sessions
    const upcoming = store.sessions.filter((s) => s.status === "scheduled");
    for (const sess of upcoming) {
      store.attendance.push({
        id: crypto.randomUUID(),
        session_id: sess.id,
        swimmer_id: newId,
        status: "not_marked",
      });
    }

    return newSwimmer;
  },

  updateSwimmer(
    id: string,
    data: Partial<Swimmer> & { email_reminders_enabled?: boolean }
  ): Swimmer | null {
    const index = store.swimmers.findIndex((s) => s.id === id);
    if (index === -1) return null;

    const current = store.swimmers[index];
    const updated: Swimmer = {
      ...current,
      ...data,
      updated_at: new Date().toISOString(),
    };

    if (data.email_reminders_enabled !== undefined && updated.reminder_preferences) {
      updated.reminder_preferences.email_reminders_enabled = data.email_reminders_enabled;
    }

    store.swimmers[index] = updated;
    return this.getSwimmerById(id);
  },

  archiveSwimmer(id: string): boolean {
    const swimmer = store.swimmers.find((s) => s.id === id);
    if (!swimmer) return false;
    swimmer.status = "archived";
    swimmer.updated_at = new Date().toISOString();
    return true;
  },

  restoreSwimmer(id: string): boolean {
    const swimmer = store.swimmers.find((s) => s.id === id);
    if (!swimmer) return false;
    swimmer.status = "active";
    swimmer.updated_at = new Date().toISOString();
    return true;
  },

  // ---------------------------------------------------------------------------
  // Sessions & Series
  // ---------------------------------------------------------------------------
  getSessions(options?: {
    status?: SessionStatus | "all";
    fromDate?: string;
    toDate?: string;
  }): SwimSession[] {
    let result = [...store.sessions];
    if (options?.status && options.status !== "all") {
      result = result.filter((s) => s.status === options.status);
    }
    if (options?.fromDate) {
      result = result.filter((s) => s.date >= options.fromDate!);
    }
    if (options?.toDate) {
      result = result.filter((s) => s.date <= options.toDate!);
    }

    // Sort by date descending, then time
    result.sort((a, b) => {
      const cmp = b.date.localeCompare(a.date);
      return cmp !== 0 ? cmp : b.start_time.localeCompare(a.start_time);
    });

    // Populate participant counts and attendance breakdown
    return result.map((sess) => {
      const records = store.attendance.filter((a) => a.session_id === sess.id);
      let present = 0,
        late = 0,
        absent = 0,
        excused = 0,
        not_marked = 0;

      for (const r of records) {
        if (r.status === "present") present++;
        else if (r.status === "late") late++;
        else if (r.status === "absent") absent++;
        else if (r.status === "excused") excused++;
        else not_marked++;
      }

      return {
        ...sess,
        participant_count: records.length,
        attendance_summary: {
          present,
          late,
          absent,
          excused,
          not_marked,
          total: records.length,
        },
      };
    });
  },

  getSessionById(id: string): SwimSession | null {
    const list = this.getSessions({ status: "all" });
    return list.find((s) => s.id === id) || null;
  },

  getNextUpcomingSession(): SwimSession | null {
    const upcoming = store.sessions
      .filter((s) => isSessionUpcomingOrActive(s))
      .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));

    if (upcoming.length > 0) {
      return this.getSessionById(upcoming[0].id);
    }
    return null;
  },

  createSession(data: {
    title: string;
    date: string;
    start_time: string;
    end_time: string;
    location: string;
    notes?: string;
    series_id?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    geofence_radius?: number | null;
  }): SwimSession {
    const newId = crypto.randomUUID();
    const newSession: SwimSession = {
      id: newId,
      series_id: data.series_id || null,
      title: data.title,
      date: data.date,
      start_time: data.start_time,
      end_time: data.end_time,
      location: data.location,
      latitude: data.latitude != null ? data.latitude : null,
      longitude: data.longitude != null ? data.longitude : null,
      geofence_radius: data.geofence_radius != null ? data.geofence_radius : 30,
      notes: data.notes || null,
      status: "scheduled",
      is_finalized: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    store.sessions.push(newSession);

    // Snapshot active swimmers into attendance register
    const activeSwimmers = store.swimmers.filter((s) => s.status === "active");
    for (const swimmer of activeSwimmers) {
      store.attendance.push({
        id: crypto.randomUUID(),
        session_id: newId,
        swimmer_id: swimmer.id,
        status: "not_marked",
      });
    }

    return this.getSessionById(newId)!;
  },

  updateSession(id: string, data: Partial<SwimSession>): SwimSession | null {
    const idx = store.sessions.findIndex((s) => s.id === id);
    if (idx === -1) return null;

    store.sessions[idx] = {
      ...store.sessions[idx],
      ...data,
      updated_at: new Date().toISOString(),
    };
    return this.getSessionById(id);
  },

  cancelSession(id: string): SwimSession | null {
    return this.updateSession(id, { status: "cancelled" });
  },

  finalizeSession(id: string, adminId?: string): SwimSession | null {
    const now = new Date().toISOString();
    const updated = this.updateSession(id, {
      is_finalized: true,
      status: "completed",
      finalized_at: now,
      finalized_by: adminId || "admin",
    });

    if (updated) {
      // Ensure all active squad members have resolved attendance; unmarked becomes absent
      const activeSwimmers = store.swimmers.filter((s) => s.status === "active");
      for (const swimmer of activeSwimmers) {
        const record = store.attendance.find(
          (a) => a.session_id === id && a.swimmer_id === swimmer.id
        );
        if (!record) {
          store.attendance.push({
            id: `att-${id}-${swimmer.id}`,
            session_id: id,
            swimmer_id: swimmer.id,
            status: "absent",
            notes: "Unmarked at finalization",
            marked_at: now,
            updated_at: now,
          });
        } else if (record.status === "not_marked") {
          record.status = "absent";
          record.notes = record.notes || "Unmarked at finalization";
          record.updated_at = now;
        }
      }
    }

    return updated;
  },

  reopenSession(id: string): SwimSession | null {
    return this.updateSession(id, {
      is_finalized: false,
      status: "scheduled",
      finalized_at: null,
      finalized_by: null,
    });
  },

  deleteSession(id: string): boolean {
    const idx = store.sessions.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    store.sessions.splice(idx, 1);
    store.attendance = store.attendance.filter((a) => a.session_id !== id);
    store.auditLogs = store.auditLogs.filter((l) => l.session_id !== id);
    store.reminders = store.reminders.filter((d) => d.session_id !== id);
    return true;
  },

  getSeries(): SessionSeries[] {
    return [...store.series];
  },

  createSeries(data: {
    title: string;
    location: string;
    recurrence_rule: "weekly" | "biweekly";
    day_of_week: number;
    start_time: string;
    end_time: string;
    start_date: string;
    occurrences_to_generate?: number;
    latitude?: number | null;
    longitude?: number | null;
    geofence_radius?: number | null;
  }): { series: SessionSeries; createdSessionsCount: number } {
    const seriesId = crypto.randomUUID();
    const newSeries: SessionSeries = {
      id: seriesId,
      title: data.title,
      location: data.location,
      recurrence_rule: data.recurrence_rule,
      day_of_week: data.day_of_week,
      start_time: data.start_time,
      end_time: data.end_time,
      start_date: data.start_date,
      active: true,
    };
    store.series.push(newSeries);

    // Generate upcoming concrete session occurrences
    const count = data.occurrences_to_generate || 4;
    let generated = 0;
    const baseDate = new Date(data.start_date);

    for (let i = 0; i < 52 && generated < count; i++) {
      const candidate = new Date(baseDate);
      candidate.setDate(baseDate.getDate() + i);

      if (candidate.getDay() === data.day_of_week) {
        const dateStr = candidate.toISOString().split("T")[0];
        // Prevent duplicate on same date & series
        const exists = store.sessions.some(
          (s) => s.series_id === seriesId && s.date === dateStr
        );
        if (!exists) {
          this.createSession({
            series_id: seriesId,
            title: data.title,
            date: dateStr,
            start_time: data.start_time,
            end_time: data.end_time,
            location: data.location,
            latitude: data.latitude,
            longitude: data.longitude,
            geofence_radius: data.geofence_radius,
          });
          generated++;
        }
      }
    }

    return { series: newSeries, createdSessionsCount: generated };
  },

  // ---------------------------------------------------------------------------
  // Attendance Command Center Operations
  // ---------------------------------------------------------------------------
  getSessionAttendance(sessionId: string): AttendanceRecord[] {
    const session = store.sessions.find((s) => s.id === sessionId);
    if (!session) {
      return [];
    }

    // Automatically ensure all active squad members have an attendance record for this session
    const activeSwimmers = store.swimmers.filter((s) => s.status === "active");
    for (const sw of activeSwimmers) {
      const exists = store.attendance.some(
        (a) => a.session_id === sessionId && a.swimmer_id === sw.id
      );
      if (!exists) {
        const newRecord: AttendanceRecord = {
          id: crypto.randomUUID(),
          session_id: sessionId,
          swimmer_id: sw.id,
          status: "not_marked",
        };
        store.attendance.push(newRecord);
        if (typeof window === "undefined") {
          import("./supabase-db").then(({ SupabaseDB }) => {
            SupabaseDB.upsertAttendance(newRecord).catch(() => {});
          });
        }
      }
    }

    const records = store.attendance.filter((a) => a.session_id === sessionId);
    return records.map((record) => {
      const swimmer = store.swimmers.find((s) => s.id === record.swimmer_id);
      return {
        ...record,
        swimmer: swimmer ? { ...swimmer } : undefined,
      };
    });
  },

  getAllAttendance(): AttendanceRecord[] {
    return store.attendance.map((record) => {
      const swimmer = store.swimmers.find((s) => s.id === record.swimmer_id);
      return {
        ...record,
        swimmer: swimmer ? { ...swimmer } : undefined,
      };
    });
  },

  updateAttendanceStatus(
    sessionId: string,
    swimmerId: string,
    status: AttendanceStatus,
    notes?: string,
    adminId?: string,
    method: "coach_manual" | "bulk" = "coach_manual"
  ): { record: AttendanceRecord; auditLog: AttendanceAuditLog } {
    let index = store.attendance.findIndex(
      (a) => a.session_id === sessionId && a.swimmer_id === swimmerId
    );

    const now = new Date().toISOString();
    let oldStatus: AttendanceStatus = "not_marked";

    if (index === -1) {
      // Create record if missing
      const newRecord: AttendanceRecord = {
        id: crypto.randomUUID(),
        session_id: sessionId,
        swimmer_id: swimmerId,
        status,
        notes: notes || null,
        checkin_method: method,
        checkin_distance: null,
        checkin_accuracy: null,
        marked_at: now,
        marked_by: adminId || "admin",
        updated_at: now,
      };
      store.attendance.push(newRecord);
      index = store.attendance.length - 1;
    } else {
      oldStatus = store.attendance[index].status;
      const statusChanged = oldStatus !== status;
      store.attendance[index] = {
        ...store.attendance[index],
        status,
        notes: notes !== undefined ? notes : store.attendance[index].notes,
        updated_at: now,
        marked_by: adminId || "admin",
        // A coach changing the status makes the old GPS evidence meaningless: record who really
        // decided it. A note-only edit keeps the original check-in provenance.
        ...(statusChanged
          ? { checkin_method: method, checkin_distance: null, checkin_accuracy: null }
          : {}),
      };
    }

    const updatedRecord = store.attendance[index];
    const swimmer = store.swimmers.find((s) => s.id === swimmerId);
    const session = store.sessions.find((s) => s.id === sessionId);

    // Create Audit Log
    const auditLog: AttendanceAuditLog = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      swimmer_id: swimmerId,
      old_status: oldStatus,
      new_status: status,
      change_reason: notes || "Direct status update",
      actor_id: adminId || "admin",
      created_at: now,
      swimmer_name: swimmer ? swimmer.full_name : "Unknown Swimmer",
      session_title: session ? session.title : "Unknown Session",
    };
    store.auditLogs.unshift(auditLog);

    return {
      record: {
        ...updatedRecord,
        swimmer: swimmer ? { ...swimmer } : undefined,
      },
      auditLog,
    };
  },

  /**
   * Marks every UNMARKED swimmer present. Swimmers who are already present, late, absent or
   * excused (incl. GPS-verified check-ins) are never touched. Returns the records that changed.
   */
  markAllPresent(sessionId: string, adminId?: string): AttendanceRecord[] {
    const targets = store.attendance.filter(
      (a) => a.session_id === sessionId && a.status === "not_marked"
    );
    const changed: AttendanceRecord[] = [];
    for (const item of targets) {
      const { record } = this.updateAttendanceStatus(
        sessionId,
        item.swimmer_id,
        "present",
        "Bulk marked present",
        adminId,
        "bulk"
      );
      changed.push(record);
    }
    return changed;
  },

  /** Marks every UNMARKED swimmer absent. Returns the records that changed. */
  markRemainingAbsent(sessionId: string, adminId?: string): AttendanceRecord[] {
    const targets = store.attendance.filter(
      (a) => a.session_id === sessionId && a.status === "not_marked"
    );
    const changed: AttendanceRecord[] = [];
    for (const item of targets) {
      const { record } = this.updateAttendanceStatus(
        sessionId,
        item.swimmer_id,
        "absent",
        "Marked remaining absent",
        adminId,
        "bulk"
      );
      changed.push(record);
    }
    return changed;
  },

  getAttendanceAuditLogs(options?: {
    sessionId?: string;
    swimmerId?: string;
    limit?: number;
  }): AttendanceAuditLog[] {
    let result = [...store.auditLogs];
    if (options?.sessionId) {
      result = result.filter((l) => l.session_id === options.sessionId);
    }
    if (options?.swimmerId) {
      result = result.filter((l) => l.swimmer_id === options.swimmerId);
    }
    const limit = options?.limit || 50;
    return result.slice(0, limit);
  },

  // ---------------------------------------------------------------------------
  // Reminders & Deliveries
  // ---------------------------------------------------------------------------
  getEligibleReminderRecipients(sessionId: string): Swimmer[] {
    const records = store.attendance.filter((a) => a.session_id === sessionId);
    const swimmerIds = new Set(records.map((r) => r.swimmer_id));

    return store.swimmers.filter((swimmer) => {
      // Must be participant in this session (if records exist)
      if (swimmerIds.size > 0 && !swimmerIds.has(swimmer.id)) return false;
      // Must be active
      if (swimmer.status !== "active") return false;
      // Must have valid email
      if (!swimmer.email || !swimmer.email.includes("@")) return false;
      // Must have email reminders enabled (consent)
      if (swimmer.reminder_preferences && !swimmer.reminder_preferences.email_reminders_enabled) {
        return false;
      }
      return true;
    });
  },

  hasReminderBeenSent(claimKey: string): boolean {
    return store.reminders.some(
      (r) => r.claim_key === claimKey && (r.status === "sent" || r.status === "pending")
    );
  },

  recordReminderDelivery(delivery: {
    claim_key: string;
    session_id: string;
    swimmer_id: string;
    reminder_type: "upcoming" | "today" | "changed" | "cancelled" | "manual";
    recipient_email: string;
    status: "pending" | "sent" | "failed" | "skipped";
    provider_message_id?: string | null;
    error_message?: string | null;
  }): ReminderDelivery {
    const swimmer = store.swimmers.find((s) => s.id === delivery.swimmer_id);
    const session = store.sessions.find((s) => s.id === delivery.session_id);

    const record: ReminderDelivery = {
      id: crypto.randomUUID(),
      claim_key: delivery.claim_key,
      session_id: delivery.session_id,
      swimmer_id: delivery.swimmer_id,
      reminder_type: delivery.reminder_type,
      recipient_email: delivery.recipient_email,
      status: delivery.status,
      provider_message_id: delivery.provider_message_id || null,
      error_message: delivery.error_message || null,
      attempt_count: 1,
      sent_at: delivery.status === "sent" ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
      swimmer_name: swimmer ? swimmer.full_name : "Swimmer",
      session_title: session ? session.title : "Swimming Session",
    };

    store.reminders.unshift(record);

    // Persist to Supabase if connected
    import("./supabase-db").then(({ SupabaseDB }) => {
      SupabaseDB.insertReminderDelivery(record).catch(() => {});
    });
    return record;
  },

  getReminderDeliveries(limit = 50): ReminderDelivery[] {
    return store.reminders.slice(0, limit);
  },

  // ---------------------------------------------------------------------------
  // Analytics & Aggregates
  // ---------------------------------------------------------------------------
  getRecentLateArrivals(limit = 6): Array<{
    id: string;
    sessionId: string;
    swimmerId: string;
    swimmerName: string;
    nickname?: string | null;
    avatarColor?: string | null;
    sessionTitle: string;
    sessionDate: string;
    sessionStartTime: string;
    arrivalTime: string | null;
    minutesLate: number;
    reason: string | null;
    notes?: string | null;
    markedAt?: string;
  }> {
    const lateRecords = store.attendance.filter((a) => a.status === "late");

    const enriched = [];

    for (const record of lateRecords) {
      const swimmer = store.swimmers.find((s) => s.id === record.swimmer_id);
      const session = store.sessions.find((s) => s.id === record.session_id);
      if (!swimmer || !session) continue;

      const parsed = parseLateInfo(record.notes);
      let mins = parsed?.minutesLate || 0;
      const arrivalTime = parsed?.arrivalTime || null;

      // If minutes was not explicitly recorded, check arrival time or default
      if (mins === 0 && arrivalTime) {
        mins = calculateMinutesLate(session.start_time, arrivalTime);
      } else if (mins === 0) {
        mins = 15; // sensible fallback
      }

      enriched.push({
        id: record.id,
        sessionId: session.id,
        swimmerId: swimmer.id,
        swimmerName: swimmer.full_name,
        nickname: swimmer.nickname,
        avatarColor: swimmer.avatar_color,
        sessionTitle: session.title,
        sessionDate: session.date,
        sessionStartTime: session.start_time,
        arrivalTime,
        minutesLate: mins,
        reason: parsed?.reason || null,
        notes: record.notes,
        markedAt: record.marked_at || record.updated_at,
      });
    }

    // Sort descending by session date, then by markedAt
    enriched.sort((a, b) => {
      const dateDiff = new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime();
      if (dateDiff !== 0) return dateDiff;
      return (b.markedAt ? new Date(b.markedAt).getTime() : 0) - (a.markedAt ? new Date(a.markedAt).getTime() : 0);
    });

    return enriched.slice(0, limit);
  },

  getDashboardStats() {
    const activeSwimmersList = store.swimmers.filter((s) => s.status === "active");
    const activeSwimmers = activeSwimmersList.length;
    const completedSessionsList = store.sessions.filter(
      (s) => s.status === "completed" || s.is_finalized
    );
    const completedSessions = completedSessionsList.length;
    const scheduledSessions = store.sessions.filter((s) => s.status === "scheduled").length;

    // Calculate squad overall attendance rate across all completed sessions
    let totalPresent = 0;
    let totalLate = 0;
    let totalAbsent = 0;

    if (completedSessionsList.length > 0 && activeSwimmersList.length > 0) {
      for (const sess of completedSessionsList) {
        for (const swimmer of activeSwimmersList) {
          const record = store.attendance.find(
            (a) => a.session_id === sess.id && a.swimmer_id === swimmer.id
          );
          if (record) {
            if (record.status === "present") totalPresent++;
            else if (record.status === "late") totalLate++;
            else if (record.status === "excused") {
              // Excused sessions are excluded from denominator
            } else {
              totalAbsent++; // absent or not_marked in completed session
            }
          } else {
            totalAbsent++; // missing record in completed session is absent
          }
        }
      }
    } else {
      // Fallback if no completed sessions or active swimmers
      const completedSessionIds = new Set(completedSessionsList.map((s) => s.id));
      const relevantRecords = store.attendance.filter((a) =>
        completedSessionIds.has(a.session_id)
      );
      for (const r of relevantRecords) {
        if (r.status === "present") totalPresent++;
        else if (r.status === "late") totalLate++;
        else if (r.status === "absent") totalAbsent++;
      }
    }

    const totalOpportunities = totalPresent + totalLate + totalAbsent;
    const overallAttendanceRate =
      totalOpportunities > 0
        ? Math.round(((totalPresent + totalLate) / totalOpportunities) * 1000) / 10
        : 0;

    // Sessions this month
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const sessionsThisMonth = store.sessions.filter((s) =>
      s.date.startsWith(currentMonth)
    ).length;

    // Late arrivals aggregate
    const allLate = this.getRecentLateArrivals(100);
    const totalLateCount = allLate.length;
    const avgMinutesLate =
      totalLateCount > 0
        ? Math.round(allLate.reduce((sum, item) => sum + item.minutesLate, 0) / totalLateCount)
        : 0;

    return {
      activeSwimmers,
      completedSessions,
      scheduledSessions,
      overallAttendanceRate,
      sessionsThisMonth,
      totalRecords: totalOpportunities,
      totalLateCount,
      avgMinutesLate,
    };
  },

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  getAppSettings(): Record<string, AppSetting> {
    return { ...store.settings };
  },

  updateAppSetting(key: string, value: Record<string, unknown>): AppSetting {
    store.settings[key] = {
      key,
      value: { ...store.settings[key]?.value, ...value },
      updated_at: new Date().toISOString(),
    };
    return store.settings[key];
  },

  // ---------------------------------------------------------------------------
  // Swimmer Portal & Squad Pass
  // ---------------------------------------------------------------------------
  getSwimmerPinHash(swimmerId: string): string | null {
    const pinsSetting = store.settings["swimmer_pins"];
    if (!pinsSetting || typeof pinsSetting.value !== "object" || pinsSetting.value === null) {
      return null;
    }
    const val = (pinsSetting.value as Record<string, string>)[swimmerId];
    return typeof val === "string" && val.length > 0 ? val : null;
  },

  hasSwimmerPin(swimmerId: string): boolean {
    return Boolean(this.getSwimmerPinHash(swimmerId));
  },

  setSwimmerPin(swimmerId: string, pinHash: string): void {
    const pinsSetting = store.settings["swimmer_pins"];
    const existing =
      pinsSetting && typeof pinsSetting.value === "object" && pinsSetting.value !== null
        ? (pinsSetting.value as Record<string, string>)
        : {};
    store.settings["swimmer_pins"] = {
      key: "swimmer_pins",
      value: {
        ...existing,
        [swimmerId]: pinHash,
      },
      updated_at: new Date().toISOString(),
    };
  },

  deleteSwimmerPin(swimmerId: string): void {
    const pinsSetting = store.settings["swimmer_pins"];
    const existing =
      pinsSetting && typeof pinsSetting.value === "object" && pinsSetting.value !== null
        ? { ...(pinsSetting.value as Record<string, string>) }
        : {};
    delete existing[swimmerId];
    store.settings["swimmer_pins"] = {
      key: "swimmer_pins",
      value: existing,
      updated_at: new Date().toISOString(),
    };
  },

  /**
   * Resolves a swimmer pass token. ONLY the swimmer's secret `opt_out_token` matches:
   * never the swimmer id or email (both are discoverable, so they are not credentials).
   * Legacy guessable tokens (`token_<id>`, demo tokens) are honoured only in demo mode,
   * i.e. when no database is configured.
   */
  getSwimmerByToken(token: string): Swimmer | null {
    if (!token || typeof token !== "string") return null;
    const cleanToken = token.trim();
    if (!cleanToken || cleanToken.length > 200) return null;

    const demoMode = !process.env.SUPABASE_SERVICE_ROLE_KEY;
    const acceptable = isStrongSwimmerToken(cleanToken) || (demoMode && cleanToken.startsWith("token_"));
    if (!acceptable) return null;

    return (
      store.swimmers.find((s) => {
        const stored = s.reminder_preferences?.opt_out_token;
        return typeof stored === "string" && timingSafeMatch(stored, cleanToken);
      }) || null
    );
  },

  /**
   * Guarantees the swimmer has an unguessable pass token, minting one if the current token is
   * missing or weak. `changed` tells the caller it must be persisted.
   */
  ensureSwimmerToken(swimmerId: string): { token: string; changed: boolean; prefId: string } | null {
    const swimmer = store.swimmers.find((s) => s.id === swimmerId);
    if (!swimmer) return null;

    const pref = swimmer.reminder_preferences;
    if (pref?.opt_out_token && isStrongSwimmerToken(pref.opt_out_token)) {
      return { token: pref.opt_out_token, changed: false, prefId: pref.id };
    }
    // Demo mode keeps its readable demo tokens working
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY && pref?.opt_out_token?.startsWith("token_")) {
      return { token: pref.opt_out_token, changed: false, prefId: pref.id };
    }

    const token = generateSwimmerToken();
    if (pref) {
      pref.opt_out_token = token;
    } else {
      swimmer.reminder_preferences = {
        id: crypto.randomUUID(),
        swimmer_id: swimmer.id,
        email_reminders_enabled: Boolean(swimmer.email),
        opt_out_token: token,
      };
    }
    return { token, changed: true, prefId: swimmer.reminder_preferences!.id };
  },

  getSwimmerAttendanceHistory(swimmerId: string) {
    const completedSessions = store.sessions.filter(
      (s) => s.status === "completed" || s.is_finalized
    );
    const existingRecords = store.attendance.filter((a) => a.swimmer_id === swimmerId);
    const recordMap = new Map<string, (typeof existingRecords)[0]>();
    for (const r of existingRecords) {
      recordMap.set(r.session_id, r);
    }

    const result: Array<AttendanceRecord & { session: SwimSession | null }> = [];

    // All existing records for this swimmer
    for (const r of existingRecords) {
      const session = store.sessions.find((s) => s.id === r.session_id);
      let status = r.status;
      // If the session was completed and status is still not_marked, it represents an unexcused absence
      if (session && (session.status === "completed" || session.is_finalized) && status === "not_marked") {
        status = "absent";
      }
      result.push({
        ...r,
        status,
        session: session || null,
      });
    }

    // Add any completed sessions where the swimmer had no record at all (unexcused absence)
    for (const compSess of completedSessions) {
      if (!recordMap.has(compSess.id)) {
        result.push({
          id: `att-absent-${compSess.id}-${swimmerId}`,
          session_id: compSess.id,
          swimmer_id: swimmerId,
          status: "absent",
          notes: "Did not attend",
          marked_at: compSess.date,
          session: compSess,
        });
      }
    }

    return result.sort((a, b) => {
      const dateA = a.session?.date || "";
      const dateB = b.session?.date || "";
      return dateB.localeCompare(dateA);
    });
  },

  /**
   * Swimmer-reported excuse ("Can't make it"). This NEVER marks a swimmer present/late —
   * only geofence check-in or the coach can do that.
   *
   * Integrity rules:
   *  - Cannot touch a record that is already present/late (verified or coach-marked).
   *  - Cannot touch a coach-set "absent" record or a coach-set excuse.
   *  - "clear" only reverts an excuse that the swimmer created themselves ("RSVP:" prefix).
   *  - Every change is written to the audit log.
   */
  submitSwimmerExcuse(
    swimmerId: string,
    sessionId: string,
    action: "declare" | "clear",
    reason?: string
  ):
    | { success: true; record: AttendanceRecord; oldStatus: AttendanceStatus; changeReason: string }
    | { success: false; error: string } {
    const nowIso = new Date().toISOString();
    const existing = store.attendance.find(
      (a) => a.swimmer_id === swimmerId && a.session_id === sessionId
    );
    const oldStatus: AttendanceStatus = existing?.status ?? "not_marked";

    if (existing && (existing.status === "present" || existing.status === "late")) {
      return {
        success: false,
        error: `You are already marked ${existing.status.toUpperCase()}. Ask the coach if this needs to change.`,
      };
    }
    if (existing?.status === "absent") {
      return { success: false, error: "The coach marked you absent. Please contact the coach." };
    }

    const isSelfExcuse = Boolean(existing?.notes?.startsWith("RSVP:"));
    if (existing?.status === "excused" && !isSelfExcuse) {
      return { success: false, error: "The coach already recorded an excuse for you." };
    }

    let record: AttendanceRecord;
    let changeReason: string;

    if (action === "declare") {
      const notes = `RSVP: Excused - ${reason || "Cannot attend"}`;
      changeReason = `Swimmer self-reported excuse (${reason || "Cannot attend"})`;
      if (existing) {
        existing.status = "excused";
        existing.notes = notes;
        existing.updated_at = nowIso;
        record = existing;
      } else {
        record = {
          id: `att-${sessionId}-${swimmerId}`,
          session_id: sessionId,
          swimmer_id: swimmerId,
          status: "excused",
          notes,
          marked_at: nowIso,
          updated_at: nowIso,
        };
        store.attendance.push(record);
      }
    } else {
      if (!existing || existing.status !== "excused") {
        return { success: false, error: "There is no excuse to clear." };
      }
      changeReason = "Swimmer cleared their self-reported excuse";
      existing.status = "not_marked";
      existing.notes = null;
      existing.updated_at = nowIso;
      record = existing;
    }

    const swimmer = store.swimmers.find((s) => s.id === swimmerId);
    const session = store.sessions.find((s) => s.id === sessionId);
    store.auditLogs.unshift({
      id: crypto.randomUUID(),
      session_id: sessionId,
      swimmer_id: swimmerId,
      old_status: oldStatus,
      new_status: record.status,
      change_reason: changeReason,
      actor_id: swimmerId,
      created_at: nowIso,
      swimmer_name: swimmer ? swimmer.full_name : "Swimmer",
      session_title: session ? session.title : "Swim Session",
    });

    return { success: true, record, oldStatus, changeReason };
  },

  /**
   * Rolls an attendance record back to its previous state (used when persisting to the database
   * fails, so memory never claims something the database does not have).
   */
  revertAttendanceChange(
    sessionId: string,
    swimmerId: string,
    previous: AttendanceRecord | null,
    auditLogId?: string
  ): void {
    const idx = store.attendance.findIndex(
      (a) => a.session_id === sessionId && a.swimmer_id === swimmerId
    );
    if (previous) {
      if (idx === -1) store.attendance.push(previous);
      else store.attendance[idx] = previous;
    } else if (idx !== -1) {
      store.attendance.splice(idx, 1);
    }
    if (auditLogId) {
      store.auditLogs = store.auditLogs.filter((l) => l.id !== auditLogId);
    }
  },

  checkInSwimmerWithGeofence(
    swimmerId: string,
    sessionId: string,
    status: AttendanceStatus,
    distanceMeters: number,
    accuracyMeters: number,
    reason?: string,
    /** Human note stored on the row; defaults to `reason`. */
    note?: string
  ): { record: AttendanceRecord; auditLog: AttendanceAuditLog } {
    let index = store.attendance.findIndex(
      (a) => a.session_id === sessionId && a.swimmer_id === swimmerId
    );

    const now = new Date().toISOString();
    let oldStatus: AttendanceStatus = "not_marked";

    if (index === -1) {
      const newRecord: AttendanceRecord = {
        id: crypto.randomUUID(),
        session_id: sessionId,
        swimmer_id: swimmerId,
        status,
        notes: note || reason || `Self check-in via Geofence (${distanceMeters}m away)`,
        checkin_method: "geofence_self",
        checkin_distance: distanceMeters,
        checkin_accuracy: accuracyMeters,
        marked_at: now,
        marked_by: swimmerId,
        updated_at: now,
      };
      store.attendance.push(newRecord);
      index = store.attendance.length - 1;
    } else {
      oldStatus = store.attendance[index].status;
      store.attendance[index] = {
        ...store.attendance[index],
        status,
        notes: note || reason || `Self check-in via Geofence (${distanceMeters}m away)`,
        checkin_method: "geofence_self",
        checkin_distance: distanceMeters,
        checkin_accuracy: accuracyMeters,
        marked_at: now,
        marked_by: swimmerId,
        updated_at: now,
      };
    }

    const updatedRecord = store.attendance[index];
    const swimmer = store.swimmers.find((s) => s.id === swimmerId);
    const session = store.sessions.find((s) => s.id === sessionId);

    // Create Audit Log
    const auditLog: AttendanceAuditLog = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      swimmer_id: swimmerId,
      old_status: oldStatus,
      new_status: status,
      change_reason: reason || `Self check-in via Geofence (${distanceMeters}m away)`,
      actor_id: swimmerId,
      created_at: now,
      swimmer_name: swimmer ? swimmer.full_name : "Swimmer",
      session_title: session ? session.title : "Swim Session",
    };
    store.auditLogs.unshift(auditLog);

    return {
      record: {
        ...updatedRecord,
        swimmer: swimmer ? { ...swimmer } : undefined,
      },
      auditLog,
    };
  },

  getSquadMessages(): SquadMessage[] {
    return (store.messages || [])
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  postSquadMessage(data: {
    author_name: string;
    content: string;
    author_swimmer_id?: string;
    is_admin?: boolean;
  }): SquadMessage {
    const newMsg: SquadMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      author_name: data.author_name.trim(),
      content: data.content.trim(),
      author_swimmer_id: data.author_swimmer_id || null,
      created_at: new Date().toISOString(),
      is_admin: data.is_admin ?? false,
    };
    if (!store.messages) store.messages = [];
    store.messages.unshift(newMsg);
    return newMsg;
  },
};
