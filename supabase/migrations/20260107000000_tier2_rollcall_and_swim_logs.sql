-- =============================================================================
-- SWIMTRACK V3 — TIER 2: PRE-SWIM LIVE ROLL-CALL & PERSONAL SWIM LOGS / PRs
-- Postgres 15+ / Supabase compatible
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PRE-SWIM LIVE ROLL-CALL ("I'm Awake / On My Way / Need a Ride")
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_roll_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.swim_sessions(id) ON DELETE CASCADE,
    swimmer_id UUID NOT NULL REFERENCES public.swimmers(id) ON DELETE CASCADE,
    swimmer_name TEXT NOT NULL CHECK (char_length(btrim(swimmer_name)) BETWEEN 1 AND 100),
    status TEXT NOT NULL CHECK (status IN ('awake', 'on_my_way', 'need_ride', 'offering_ride', 'running_late')),
    note TEXT CHECK (note IS NULL OR char_length(note) <= 140),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_session_roll_call UNIQUE (session_id, swimmer_id)
);

CREATE INDEX IF NOT EXISTS idx_session_roll_calls_session
    ON public.session_roll_calls (session_id, updated_at DESC);

-- -----------------------------------------------------------------------------
-- 2. PERSONAL SWIM LOGS, DISTANCE & PERSONAL RECORDS (PRs)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.swim_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    swimmer_id UUID NOT NULL REFERENCES public.swimmers(id) ON DELETE CASCADE,
    swimmer_name TEXT NOT NULL CHECK (char_length(btrim(swimmer_name)) BETWEEN 1 AND 100),
    session_id UUID REFERENCES public.swim_sessions(id) ON DELETE SET NULL,
    log_date DATE NOT NULL,
    distance_meters INT NOT NULL CHECK (distance_meters BETWEEN 25 AND 50000),
    laps INT CHECK (laps IS NULL OR laps BETWEEN 1 AND 2000),
    pool_length_meters INT NOT NULL DEFAULT 25 CHECK (pool_length_meters IN (25, 50)),
    stroke TEXT NOT NULL DEFAULT 'freestyle' CHECK (stroke IN ('freestyle', 'breaststroke', 'backstroke', 'butterfly', 'mixed')),
    duration_minutes INT CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 600),
    best_50m_seconds NUMERIC(6, 2) CHECK (best_50m_seconds IS NULL OR best_50m_seconds BETWEEN 15 AND 600),
    best_100m_seconds NUMERIC(6, 2) CHECK (best_100m_seconds IS NULL OR best_100m_seconds BETWEEN 35 AND 1200),
    feeling TEXT NOT NULL DEFAULT 'strong' CHECK (feeling IN ('beast', 'strong', 'steady', 'tired')),
    notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 240),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_swim_logs_date_desc
    ON public.swim_logs (log_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_swim_logs_swimmer
    ON public.swim_logs (swimmer_id, log_date DESC);

-- -----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (ADMIN CRUD; SERVICE-ROLE ROUTES HANDLE SWIMMER AUTH)
-- -----------------------------------------------------------------------------
ALTER TABLE public.session_roll_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swim_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin access for session_roll_calls" ON public.session_roll_calls;
CREATE POLICY "Admin access for session_roll_calls" ON public.session_roll_calls
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin access for swim_logs" ON public.swim_logs;
CREATE POLICY "Admin access for swim_logs" ON public.swim_logs
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
