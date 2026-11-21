-- =============================================================================
-- SWIMTRACK V3 — SAVED SWIMMING PLACES (CUSTOM POOL VENUES)
-- Postgres 15+ / Supabase compatible
-- =============================================================================

-- 1. Create pool_venues table so coaches/admins can manage their own swimming places
CREATE TABLE IF NOT EXISTS public.pool_venues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(btrim(name)) > 0),
    short_name TEXT NOT NULL CHECK (char_length(btrim(short_name)) > 0),
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    radius_meters INT NOT NULL DEFAULT 75 CHECK (radius_meters BETWEEN 25 AND 250),
    is_default BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enforce at most one default pool at the database level
CREATE UNIQUE INDEX IF NOT EXISTS uq_pool_venues_single_default
    ON public.pool_venues (is_default)
    WHERE is_default = true;

-- Fast case-insensitive name lookup
CREATE INDEX IF NOT EXISTS idx_pool_venues_name_lower
    ON public.pool_venues (lower(name));

-- 2. Link swim_sessions and session_series to pool_venues (nullable FK so ad-hoc pins still work)
ALTER TABLE public.swim_sessions
    ADD COLUMN IF NOT EXISTS venue_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_swim_sessions_venue_id'
          AND conrelid = 'public.swim_sessions'::regclass
    ) THEN
        ALTER TABLE public.swim_sessions
            ADD CONSTRAINT fk_swim_sessions_venue_id
            FOREIGN KEY (venue_id) REFERENCES public.pool_venues(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_swim_sessions_venue_id
    ON public.swim_sessions (venue_id)
    WHERE venue_id IS NOT NULL;

-- Store coordinates & venue link on recurring session_series as well
ALTER TABLE public.session_series
    ADD COLUMN IF NOT EXISTS venue_id UUID,
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS geofence_radius INT DEFAULT 75;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_session_series_venue_id'
          AND conrelid = 'public.session_series'::regclass
    ) THEN
        ALTER TABLE public.session_series
            ADD CONSTRAINT fk_session_series_venue_id
            FOREIGN KEY (venue_id) REFERENCES public.pool_venues(id)
            ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_session_series_geofence_radius'
          AND conrelid = 'public.session_series'::regclass
    ) THEN
        ALTER TABLE public.session_series
            ADD CONSTRAINT chk_session_series_geofence_radius
            CHECK (geofence_radius IS NULL OR geofence_radius BETWEEN 25 AND 250);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_session_series_venue_id
    ON public.session_series (venue_id)
    WHERE venue_id IS NOT NULL;

-- 3. Row Level Security (admin-only CRUD, service-role bypasses RLS for server actions)
ALTER TABLE public.pool_venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin access for pool_venues" ON public.pool_venues;
CREATE POLICY "Admin access for pool_venues" ON public.pool_venues
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Automatic updated_at trigger
DROP TRIGGER IF EXISTS trg_pool_venues_updated_at ON public.pool_venues;
CREATE TRIGGER trg_pool_venues_updated_at
    BEFORE UPDATE ON public.pool_venues
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. Idempotent starter seed only if no venues exist yet
INSERT INTO public.pool_venues (name, short_name, latitude, longitude, radius_meters, is_default)
SELECT
    'Royal College Aquatic Complex, Colombo',
    'Royal Aquatic (Colombo)',
    6.9056,
    79.8614,
    75,
    true
WHERE NOT EXISTS (SELECT 1 FROM public.pool_venues);
