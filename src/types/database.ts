export type AttendanceStatus =
  | "not_marked"
  | "present"
  | "absent"
  | "late"
  | "excused";

export type SessionStatus = "scheduled" | "completed" | "cancelled";

export type SwimmerStatus = "active" | "archived";

export interface Swimmer {
  id: string;
  full_name: string;
  nickname?: string | null;
  email?: string | null;
  phone?: string | null;
  join_date: string;
  status: SwimmerStatus;
  notes?: string | null;
  avatar_color?: string | null;
  created_at?: string;
  updated_at?: string;
  // joined properties
  reminder_preferences?: ReminderPreference | null;
  attendance_stats?: {
    total: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
    rate: number;
    currentStreak: number;
    longestStreak: number;
    gpsCheckins?: number;
    totalLateMinutes?: number;
    sessionsEvaluated?: number;
    recentForm?: AttendanceStatus[];
  };
}

export interface ReminderPreference {
  id: string;
  swimmer_id: string;
  email_reminders_enabled: boolean;
  opt_out_token?: string | null;
  opted_out_at?: string | null;
  updated_at?: string;
}

export interface PoolVenue {
  id: string;
  name: string;
  short_name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_default: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SessionSeries {
  id: string;
  title: string;
  location: string;
  venue_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geofence_radius?: number | null;
  recurrence_rule: "weekly" | "biweekly";
  day_of_week: number; // 0 = Sunday, 6 = Saturday
  start_time: string; // HH:mm:ss
  end_time: string; // HH:mm:ss
  start_date: string; // YYYY-MM-DD
  end_date?: string | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SwimSession {
  id: string;
  series_id?: string | null;
  venue_id?: string | null;
  title: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm:ss
  end_time: string; // HH:mm:ss
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  geofence_radius?: number | null;
  notes?: string | null;
  status: SessionStatus;
  is_finalized: boolean;
  finalized_at?: string | null;
  finalized_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // joined fields
  participant_count?: number;
  attendance_summary?: {
    present: number;
    late: number;
    absent: number;
    excused: number;
    not_marked: number;
    total: number;
  };
}

export interface SessionParticipant {
  id: string;
  session_id: string;
  swimmer_id: string;
  enrolled_at?: string;
  swimmer?: Swimmer;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  swimmer_id: string;
  status: AttendanceStatus;
  notes?: string | null;
  checkin_method?: "coach_manual" | "geofence_self" | "bulk" | null;
  checkin_distance?: number | null;
  checkin_accuracy?: number | null;
  marked_at?: string;
  marked_by?: string | null;
  updated_at?: string;
  swimmer?: Swimmer;
}

export interface AttendanceAuditLog {
  id: string;
  session_id: string;
  swimmer_id: string;
  old_status: AttendanceStatus;
  new_status: AttendanceStatus;
  change_reason?: string | null;
  actor_id?: string | null;
  created_at: string;
  swimmer_name?: string;
  session_title?: string;
}

export interface ReminderDelivery {
  id: string;
  claim_key: string;
  session_id: string;
  swimmer_id: string;
  reminder_type: "upcoming" | "today" | "changed" | "cancelled" | "manual";
  recipient_email: string;
  status: "pending" | "sent" | "failed" | "skipped";
  provider_message_id?: string | null;
  error_message?: string | null;
  attempt_count: number;
  sent_at?: string | null;
  created_at: string;
  swimmer_name?: string;
  session_title?: string;
}

export interface AppSetting {
  key: string;
  value: Record<string, unknown>;
  description?: string | null;
  updated_at?: string;
}

export interface AttendanceCalculationResult {
  totalOpportunities: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  notMarked: number;
  attendanceRate: number; // (present + late) / (present + late + absent) * 100
}

export interface SquadMessage {
  id: string;
  author_name: string;
  author_swimmer_id?: string | null;
  content: string;
  created_at: string;
  is_admin?: boolean;
}

export interface SquadMemoryPhoto {
  id: string;
  memory_id: string;
  slot: 1 | 2 | 3;
  storage_path: string;
  mime_type: "image/webp" | "image/jpeg" | "image/png";
  size_bytes: number;
  width?: number | null;
  height?: number | null;
  caption?: string | null;
  uploaded_by_name: string;
  uploaded_by_swimmer_id?: string | null;
  uploaded_by_role: "admin" | "swimmer";
  created_at: string;
  /** Ephemeral signed URL (or data URL in local demo mode) attached server-side for authorized viewers */
  signed_url?: string | null;
}

export interface SquadMemory {
  id: string;
  memory_date: string; // YYYY-MM-DD (required)
  session_id?: string | null;
  title: string;
  caption?: string | null;
  location?: string | null;
  created_by_name: string;
  created_by_swimmer_id?: string | null;
  created_at: string;
  updated_at?: string;
  photos: SquadMemoryPhoto[];
  // Optional hydrated session info
  session_title?: string | null;
  session_location?: string | null;
}


