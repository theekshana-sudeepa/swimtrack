-- =============================================================================
-- SWIMTRACK V2 — GEOFENCE ATTENDANCE & VENUE GPS COORDINATES
-- =============================================================================

-- 1. Add coordinates and geofence radius to swim_sessions
ALTER TABLE public.swim_sessions 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS geofence_radius INT DEFAULT 90;

-- 2. Add geofence checkin metadata to attendance
ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS checkin_method TEXT DEFAULT 'coach_manual',
ADD COLUMN IF NOT EXISTS checkin_distance DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS checkin_accuracy DOUBLE PRECISION;

-- 3. Index for querying geofence checkin status
CREATE INDEX IF NOT EXISTS idx_attendance_checkin_method ON public.attendance(checkin_method);

