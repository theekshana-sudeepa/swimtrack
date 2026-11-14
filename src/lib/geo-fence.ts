import { SwimSession, AttendanceStatus } from "@/types/database";
import { getCurrentColomboTime, parseTimeToMinutes, formatLateNote } from "./attendance-calculator";

/** Default geofence radius. Phone GPS beside a pool is typically +/-10-30 m, so 30 m was unusable. */
export const DEFAULT_GEOFENCE_RADIUS_METERS = 75;
/** Readings coarser than this (cell tower / wifi estimates) are rejected. */
export const MAX_GPS_ACCURACY_METERS = 50;
/** A GPS reading older than this is considered stale (replay protection). */
export const MAX_POSITION_AGE_MS = 90_000;
/** Default minutes after start before a GPS check-in counts as "late" (coach-configurable). */
export const DEFAULT_LATE_THRESHOLD_MINUTES = 10;

export interface VenueLocation {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

/**
 * Registry of known aquatic centers & swimming pools in Sri Lanka.
 * Default radius (DEFAULT_GEOFENCE_RADIUS_METERS) comfortably covers the pool deck,
 * spectator stands and changing facilities while excluding neighbouring streets.
 */
export const KNOWN_VENUES: Record<string, VenueLocation> = {
  bandaranayake: {
    name: "Bandaranayake College Swimming Pool Complex, Gampaha",
    latitude: 7.0917,
    longitude: 79.9996,
    radiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS,
  },
  ranaviru_apparels: {
    name: "Ranaviru Apparels Swimming Pool, Yakkala",
    latitude: 7.0785,
    longitude: 80.036,
    radiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS,
  },
};

/**
 * Matches a location name string against known squad swimming venues.
 */
export function matchKnownVenueByName(locationName?: string | null): VenueLocation | null {
  const loc = (locationName || "").toLowerCase().trim();
  if (!loc) return null;
  for (const venue of Object.values(KNOWN_VENUES)) {
    const venueLower = venue.name.toLowerCase();
    if (
      loc.includes(venueLower) ||
      venueLower.includes(loc) ||
      (loc.includes("bandaranayake") && venueLower.includes("bandaranayake")) ||
      (loc.includes("ranaviru") && venueLower.includes("ranaviru")) ||
      (loc.includes("yakkala") && venueLower.includes("yakkala"))
    ) {
      return venue;
    }
  }
  return null;
}

/**
 * STRICT venue resolver: returns null when the session has no explicit coordinates and its
 * location text matches no known venue. Used for anything security-relevant (check-in) so a
 * swimmer can never be verified against the wrong pool.
 */
export function resolveSessionVenue(session: SwimSession): VenueLocation | null {
  if (session.latitude != null && session.longitude != null) {
    return {
      name: session.location,
      latitude: session.latitude,
      longitude: session.longitude,
      radiusMeters: session.geofence_radius || DEFAULT_GEOFENCE_RADIUS_METERS,
    };
  }

  return matchKnownVenueByName(session.location);
}

/**
 * Display-only helper (map preview, radar UI). Falls back to the default pool when the venue is
 * unknown. NEVER use this for validating a check-in - use resolveSessionVenue().
 */
export function getSessionVenueCoordinates(session: SwimSession): VenueLocation {
  return resolveSessionVenue(session) ?? KNOWN_VENUES.bandaranayake;
}

/**
 * Mathematically precise Haversine distance formula.
 * Returns distance between two geographic coordinates in meters.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export interface GeofenceValidationResult {
  isValid: boolean;
  distanceMeters: number;
  radiusMeters: number;
  status: AttendanceStatus;
  isLate: boolean;
  minutesLate: number;
  /** Audit-trail reason (machine-ish, may be extended with IP etc.). */
  reason?: string;
  /** Human note stored on the attendance row. Late notes use the coach-editor format. */
  note?: string;
  error?: string;
}

/**
 * Strict Server-Side Validation:
 * 1. Checks if the session is active today.
 * 2. Checks if current Colombo time is within the allowable session check-in window:
 *    [session.start_time - 30 mins, session.end_time + 15 mins].
 * 3. Enforces GPS accuracy threshold (rejects accuracy > MAX_GPS_ACCURACY_METERS).
 * 4. Checks timestamp freshness to prevent replay attacks (< 90 seconds old).
 * 5. Re-computes Haversine distance on server against venue coordinates.
 * 6. Determines 'present' vs 'late' (if arrival is > 10 mins past session start).
 */
export function validateGeofenceCheckin(params: {
  userLat: number;
  userLng: number;
  accuracy: number;
  clientTimestamp: number;
  session: SwimSession;
  bypassTimeWindowForDev?: boolean;
  lateThresholdMinutes?: number;
}): GeofenceValidationResult {
  const { userLat, userLng, accuracy, clientTimestamp, session, bypassTimeWindowForDev } = params;
  const lateThreshold = Number.isFinite(params.lateThresholdMinutes)
    ? Math.max(0, params.lateThresholdMinutes as number)
    : DEFAULT_LATE_THRESHOLD_MINUTES;
  const venue = resolveSessionVenue(session);

  if (!venue) {
    return {
      isValid: false,
      distanceMeters: 0,
      radiusMeters: 0,
      status: "not_marked",
      isLate: false,
      minutesLate: 0,
      error:
        "This session has no verified pool location, so GPS check-in is unavailable. Please ask the coach to mark your attendance.",
    };
  }

  // 0. Reject malformed / non-finite input outright
  if (
    ![userLat, userLng, accuracy, clientTimestamp].every(Number.isFinite) ||
    Math.abs(userLat) > 90 ||
    Math.abs(userLng) > 180 ||
    accuracy < 0
  ) {
    return {
      isValid: false,
      distanceMeters: 0,
      radiusMeters: venue.radiusMeters,
      status: "not_marked",
      isLate: false,
      minutesLate: 0,
      error: "Invalid location reading. Please refresh your GPS and try again.",
    };
  }

  // 1. Calculate distance on server
  const distanceMeters = calculateHaversineDistance(
    userLat,
    userLng,
    venue.latitude,
    venue.longitude
  );

  // 2. Accuracy check (anti-coarse / anti-IP spoofing)
  // High quality GPS is typically < 25m. Reject anything coarser than MAX_GPS_ACCURACY_METERS.
  if (accuracy > MAX_GPS_ACCURACY_METERS) {
    return {
      isValid: false,
      distanceMeters,
      radiusMeters: venue.radiusMeters,
      status: "not_marked",
      isLate: false,
      minutesLate: 0,
      error: `GPS accuracy is too low (±${Math.round(accuracy)}m). Please step outside or move closer to the open pool deck.`,
    };
  }

  // 3. Freshness check (prevents replay of previously captured coordinates)
  const nowMs = Date.now();
  const timeDiffSec = Math.abs(nowMs - clientTimestamp) / 1000;
  if (!bypassTimeWindowForDev && timeDiffSec * 1000 > MAX_POSITION_AGE_MS) {
    return {
      isValid: false,
      distanceMeters,
      radiusMeters: venue.radiusMeters,
      status: "not_marked",
      isLate: false,
      minutesLate: 0,
      error: "Location reading expired. Please refresh your browser and try again.",
    };
  }

  // 4. Session Date & Time Window Verification (Colombo Time UTC+5:30)
  const colombo = getCurrentColomboTime();
  const todayColombo = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
  }).format(new Date()); // YYYY-MM-DD

  if (!bypassTimeWindowForDev) {
    // Check if session date matches today
    if (session.date !== todayColombo) {
      return {
        isValid: false,
        distanceMeters,
        radiusMeters: venue.radiusMeters,
        status: "not_marked",
        isLate: false,
        minutesLate: 0,
        error: `Check-in is only available on session day (${session.date}). Today is ${todayColombo}.`,
      };
    }

    const sessionStartMin = parseTimeToMinutes(session.start_time);
    const sessionEndMin = parseTimeToMinutes(session.end_time);

    // Earliest check-in: 30 minutes before practice
    const earliestCheckinMin = Math.max(0, sessionStartMin - 30);
    // Latest check-in: 20 minutes after practice ends
    const latestCheckinMin = sessionEndMin + 20;

    if (colombo.totalMinutes < earliestCheckinMin) {
      const minsUntilOpen = earliestCheckinMin - colombo.totalMinutes;
      return {
        isValid: false,
        distanceMeters,
        radiusMeters: venue.radiusMeters,
        status: "not_marked",
        isLate: false,
        minutesLate: 0,
        error: `Check-in is not open yet. Check-in opens 30 minutes before practice (in ${minsUntilOpen} minutes).`,
      };
    }

    if (colombo.totalMinutes > latestCheckinMin) {
      return {
        isValid: false,
        distanceMeters,
        radiusMeters: venue.radiusMeters,
        status: "not_marked",
        isLate: false,
        minutesLate: 0,
        error: "This swimming practice has ended. Check-in is now closed.",
      };
    }
  }

  // 5. Geofence Distance Check
  if (distanceMeters > venue.radiusMeters) {
    return {
      isValid: false,
      distanceMeters,
      radiusMeters: venue.radiusMeters,
      status: "not_marked",
      isLate: false,
      minutesLate: 0,
      error: `You are ${distanceMeters}m away from ${venue.name}. You must be within ${venue.radiusMeters}m of the pool to check in.`,
    };
  }

  // 6. Present vs Late Determination
  const sessionStartMin = parseTimeToMinutes(session.start_time);
  const minutesLate = Math.max(0, colombo.totalMinutes - sessionStartMin);
  const isLate = minutesLate > lateThreshold;
  const status: AttendanceStatus = isLate ? "late" : "present";

  const reason = isLate
    ? `Self check-in via Geofence (Late by ${minutesLate}m at ${colombo.time12}, ${distanceMeters}m from pool center)`
    : `Self check-in via Geofence (On time at ${colombo.time12}, ${distanceMeters}m from pool center)`;

  // Late notes use the exact format the coach's late editor parses ("Arrived at … (Xm late)")
  const note = isLate
    ? formatLateNote(colombo.time12, minutesLate, `GPS check-in, ${distanceMeters}m from pool`)
    : `Checked in at ${colombo.time12} via GPS (${distanceMeters}m from pool)`;

  return {
    isValid: true,
    distanceMeters,
    radiusMeters: venue.radiusMeters,
    status,
    isLate,
    minutesLate,
    reason,
    note,
  };
}
