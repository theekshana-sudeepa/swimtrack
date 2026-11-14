-- =============================================================================
-- SWIMTRACK V3 - GEOFENCE HARDENING
-- =============================================================================

-- 1. Real-world GPS radius: 30 m is unusable with phone GPS (+/-10-30 m). Default to 75 m and
--    lift any previously-saved too-tight radius (<75) up to the new default.
ALTER TABLE public.swim_sessions
  ALTER COLUMN geofence_radius SET DEFAULT 75;

UPDATE public.swim_sessions
   SET geofence_radius = LEAST(GREATEST(COALESCE(geofence_radius, 75), 75), 250)
 WHERE geofence_radius IS NULL OR geofence_radius < 75 OR geofence_radius > 250;

ALTER TABLE public.swim_sessions
  DROP CONSTRAINT IF EXISTS chk_swim_sessions_geofence_radius;
ALTER TABLE public.swim_sessions
  ADD CONSTRAINT chk_swim_sessions_geofence_radius
  CHECK (geofence_radius IS NULL OR geofence_radius BETWEEN 25 AND 250);

-- 2. Constrain provenance values so the coach register can always trust the badge.
UPDATE public.attendance
   SET checkin_method = 'coach_manual'
 WHERE checkin_method IS NULL
    OR checkin_method NOT IN ('coach_manual', 'geofence_self', 'bulk');

ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS chk_attendance_checkin_method;
ALTER TABLE public.attendance
  ADD CONSTRAINT chk_attendance_checkin_method
  CHECK (checkin_method IN ('coach_manual', 'geofence_self', 'bulk'));

-- 3. Evidence only makes sense for GPS check-ins.
UPDATE public.attendance
   SET checkin_distance = NULL, checkin_accuracy = NULL
 WHERE checkin_method <> 'geofence_self';

ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS chk_attendance_geo_evidence;
ALTER TABLE public.attendance
  ADD CONSTRAINT chk_attendance_geo_evidence
  CHECK (
    checkin_method = 'geofence_self'
    OR (checkin_distance IS NULL AND checkin_accuracy IS NULL)
  );

-- NOTE: UNIQUE (session_id, swimmer_id) already exists (uq_attendance_session_swimmer), which is
-- what makes concurrent / double check-ins collapse into a single row at the database level.
