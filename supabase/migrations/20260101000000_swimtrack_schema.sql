-- =============================================================================
-- SWIMTRACK V2 — DATABASE SCHEMA DEFINITION & ROW LEVEL SECURITY
-- Postgres 15+ / Supabase compatible
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. APP SETTINGS & ADMIN CONFIGURATION
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Insert default application settings
INSERT INTO public.app_settings (key, value, description)
VALUES 
    ('general', '{"group_name": "SwimTrack Club", "default_pool": "Bandaranayake College Swimming Pool Complex, Gampaha", "default_duration_minutes": 60, "timezone": "Asia/Colombo"}', 'General club preferences'),
    ('reminders', '{"auto_reminders_enabled": true, "reminder_hours_before": 24, "default_message": "Don''t forget your swim session tomorrow! Bring your goggles and towel."}', 'Email reminder preferences')
ON CONFLICT (key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. SWIMMERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.swimmers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    nickname TEXT,
    email TEXT,
    phone TEXT,
    join_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    notes TEXT,
    avatar_color TEXT DEFAULT 'ocean',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_swimmers_status ON public.swimmers(status);
CREATE INDEX IF NOT EXISTS idx_swimmers_email ON public.swimmers(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_swimmers_full_name ON public.swimmers(full_name);

-- -----------------------------------------------------------------------------
-- 3. REMINDER PREFERENCES (Consent & Opt-Out)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reminder_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    swimmer_id UUID NOT NULL REFERENCES public.swimmers(id) ON DELETE CASCADE,
    email_reminders_enabled BOOLEAN NOT NULL DEFAULT true,
    opt_out_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
    opted_out_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_swimmer_reminder_pref UNIQUE (swimmer_id)
);

CREATE INDEX IF NOT EXISTS idx_reminder_pref_swimmer ON public.reminder_preferences(swimmer_id);
CREATE INDEX IF NOT EXISTS idx_reminder_pref_optout ON public.reminder_preferences(opt_out_token);

-- -----------------------------------------------------------------------------
-- 4. SESSION RECURRENCE SERIES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    location TEXT NOT NULL,
    recurrence_rule TEXT NOT NULL DEFAULT 'weekly' CHECK (recurrence_rule IN ('weekly', 'biweekly')),
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_session_series_active ON public.session_series(active);

-- -----------------------------------------------------------------------------
-- 5. SWIM SESSIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.swim_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID REFERENCES public.session_series(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    is_finalized BOOLEAN NOT NULL DEFAULT false,
    finalized_at TIMESTAMPTZ,
    finalized_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_swim_sessions_date ON public.swim_sessions(date DESC);
CREATE INDEX IF NOT EXISTS idx_swim_sessions_status ON public.swim_sessions(status);
CREATE INDEX IF NOT EXISTS idx_swim_sessions_series ON public.swim_sessions(series_id);
CREATE INDEX IF NOT EXISTS idx_swim_sessions_finalized ON public.swim_sessions(is_finalized);

-- -----------------------------------------------------------------------------
-- 6. SESSION PARTICIPANTS (Historical Snapshot per Session)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.swim_sessions(id) ON DELETE CASCADE,
    swimmer_id UUID NOT NULL REFERENCES public.swimmers(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_session_participant UNIQUE (session_id, swimmer_id)
);

CREATE INDEX IF NOT EXISTS idx_session_participants_session ON public.session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_swimmer ON public.session_participants(swimmer_id);

-- -----------------------------------------------------------------------------
-- 7. ATTENDANCE TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.swim_sessions(id) ON DELETE CASCADE,
    swimmer_id UUID NOT NULL REFERENCES public.swimmers(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'not_marked' CHECK (status IN ('not_marked', 'present', 'absent', 'late', 'excused')),
    notes TEXT,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    marked_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_attendance_session_swimmer UNIQUE (session_id, swimmer_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_session ON public.attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_swimmer ON public.attendance(swimmer_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON public.attendance(status);
CREATE INDEX IF NOT EXISTS idx_attendance_session_status ON public.attendance(session_id, status);

-- -----------------------------------------------------------------------------
-- 8. ATTENDANCE AUDIT LOG (Private History Trail)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.swim_sessions(id) ON DELETE CASCADE,
    swimmer_id UUID NOT NULL REFERENCES public.swimmers(id) ON DELETE CASCADE,
    old_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    change_reason TEXT,
    actor_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_log_session ON public.attendance_audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_swimmer ON public.attendance_audit_log(swimmer_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.attendance_audit_log(created_at DESC);

-- -----------------------------------------------------------------------------
-- 9. REMINDER DELIVERIES (Atomic Claim Locks & Idempotency)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reminder_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_key TEXT NOT NULL UNIQUE, -- e.g. "{sessionId}:{swimmerId}:{reminderType}:{dateStr}"
    session_id UUID REFERENCES public.swim_sessions(id) ON DELETE CASCADE,
    swimmer_id UUID REFERENCES public.swimmers(id) ON DELETE CASCADE,
    reminder_type TEXT NOT NULL CHECK (reminder_type IN ('upcoming', 'today', 'changed', 'cancelled', 'manual')),
    recipient_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
    provider_message_id TEXT,
    error_message TEXT,
    attempt_count INT NOT NULL DEFAULT 1,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_reminder_deliv_claim ON public.reminder_deliveries(claim_key);
CREATE INDEX IF NOT EXISTS idx_reminder_deliv_session ON public.reminder_deliveries(session_id);
CREATE INDEX IF NOT EXISTS idx_reminder_deliv_swimmer ON public.reminder_deliveries(swimmer_id);
CREATE INDEX IF NOT EXISTS idx_reminder_deliv_created ON public.reminder_deliveries(created_at DESC);

-- -----------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- Admin-only and service-role protection
-- -----------------------------------------------------------------------------
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swimmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swim_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_deliveries ENABLE ROW LEVEL SECURITY;

-- Helper check function for authenticated admin
-- Authenticated users (admin) have full CRUD access
CREATE POLICY "Admin access for app_settings" ON public.app_settings
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin access for swimmers" ON public.swimmers
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin access for reminder_preferences" ON public.reminder_preferences
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin access for session_series" ON public.session_series
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin access for swim_sessions" ON public.swim_sessions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin access for session_participants" ON public.session_participants
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin access for attendance" ON public.attendance
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin access for attendance_audit_log" ON public.attendance_audit_log
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin access for reminder_deliveries" ON public.reminder_deliveries
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow swimmers to opt-out anonymously using their secret token
CREATE POLICY "Public token opt-out for reminder_preferences" ON public.reminder_preferences
    FOR UPDATE TO anon
    USING (opt_out_token IS NOT NULL)
    WITH CHECK (opt_out_token IS NOT NULL);

-- -----------------------------------------------------------------------------
-- 11. AUTOMATIC UPDATED_AT TRIGGER
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_swimmers_updated_at
    BEFORE UPDATE ON public.swimmers
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_session_series_updated_at
    BEFORE UPDATE ON public.session_series
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_swim_sessions_updated_at
    BEFORE UPDATE ON public.swim_sessions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_attendance_updated_at
    BEFORE UPDATE ON public.attendance
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_app_settings_updated_at
    BEFORE UPDATE ON public.app_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

