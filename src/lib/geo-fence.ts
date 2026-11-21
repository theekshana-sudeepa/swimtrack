import { SwimSession, AttendanceStatus, PoolVenue } from "@/types/database";
import { getCurrentColomboTime, parseTimeToMinutes, formatLateNote } from "./attendance-calculator";

/** Minimum & maximum allowable geofence radius (matches DB CHECK constraint). */
export const MIN_GEOFENCE_RADIUS_METERS = 25;
export const MAX_GEOFENCE_RADIUS_METERS = 250;
/** Default geofence radius. Phone GPS beside a pool is typically +/-10-30 m, so 30 m was unusable. */
export const DEFAULT_GEOFENCE_RADIUS_METERS = 75;
/** Readings coarser than this (cell tower / wifi estimates) are rejected. */
export const MAX_GPS_ACCURACY_METERS = 50;
/** A GPS reading older than this is considered stale (replay protection). */
export const MAX_POSITION_AGE_MS = 90_000;
/** Default minutes after start before a GPS check-in counts as "late" (coach-configurable). */
export const DEFAULT_LATE_THRESHOLD_MINUTES = 10;

export function clampGeofenceRadiusMeters(
  raw: number | string | null | undefined,
  fallback = DEFAULT_GEOFENCE_RADIUS_METERS
): number {
  const parsed = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(MAX_GEOFENCE_RADIUS_METERS, Math.max(MIN_GEOFENCE_RADIUS_METERS, Math.round(parsed)));
}

export function deriveShortVenueName(fullName: string): string {
  const clean = fullName.trim();
  if (!clean) return "Swimming Pool";
  const firstSegment = clean.split(",")[0]?.trim() || clean;
  return firstSegment.length > 36 ? `${firstSegment.slice(0, 35).trim()}…` : firstSegment;
}

/**
 * Parses raw coordinates pasted from Google Maps or GPS tools:
 * - "6.9056, 79.8614" or "6.9056 79.8614"
 * - Google Maps URLs like ".../@6.905612,79.861401,17z" or "...?q=6.9056,79.8614" or "!3d6.9056!4d79.8614"
 */
export function parseCoordinatesInput(
  raw: string
): { latitude: number; longitude: number } | null {
  const input = (raw || "").trim();
  if (!input) return null;

  // 1. Direct "lat, lng" pair (e.g. copied from Google Maps right-click)
  const directMatch = input.match(
    /^(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/
  );
  if (directMatch) {
    const lat = parseFloat(directMatch[1]);
    const lng = parseFloat(directMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) };
    }
  }

  // 2. Google Maps "!3dLAT!4dLNG" exact pin marker inside URL
  const bangMatch = input.match(/!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/);
  if (bangMatch) {
    const lat = parseFloat(bangMatch[1]);
    const lng = parseFloat(bangMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) };
    }
  }

  // 3. Google Maps "@lat,lng" or "?q=lat,lng" / "ll=lat,lng"
  const urlMatch = input.match(
    /(?:@|[?&](?:q|ll|destination)=)(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/
  );
  if (urlMatch) {
    const lat = parseFloat(urlMatch[1]);
    const lng = parseFloat(urlMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) };
    }
  }

  return null;
}

export interface VenueLocation {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface PresetVenue extends VenueLocation {
  key: string;
  shortName: string;
}

export type VenueCandidate =
  | PresetVenue
  | PoolVenue
  | (VenueLocation & { id?: string; shortName?: string; short_name?: string });

export function normalizeVenueCandidate(v: VenueCandidate): {
  id?: string;
  name: string;
  shortName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
} {
  const radius =
    "radius_meters" in v
      ? v.radius_meters
      : "radiusMeters" in v
      ? v.radiusMeters
      : DEFAULT_GEOFENCE_RADIUS_METERS;
  const shortName =
    "short_name" in v && v.short_name
      ? v.short_name
      : "shortName" in v && v.shortName
      ? v.shortName
      : deriveShortVenueName(v.name);
  return {
    id: "id" in v ? v.id : undefined,
    name: v.name,
    shortName,
    latitude: v.latitude,
    longitude: v.longitude,
    radiusMeters: clampGeofenceRadiusMeters(radius),
  };
}

const FALLBACK_PRESET_VENUES: PresetVenue[] = [
  {
    key: "royal_aquatic",
    name: "Royal College Aquatic Complex, Colombo",
    shortName: "Royal Aquatic (Colombo)",
    latitude: 6.9056,
    longitude: 79.8614,
    radiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS,
  },
  {
    key: "sugathadasa_pool",
    name: "Sugathadasa Stadium Swimming Pool, Colombo",
    shortName: "Sugathadasa Pool (Colombo)",
    latitude: 6.9491,
    longitude: 79.8689,
    radiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS,
  },
];

function parseEnvPresetVenues(): PresetVenue[] {
  const raw = process.env.NEXT_PUBLIC_PRESET_VENUES;
  if (!raw) return FALLBACK_PRESET_VENUES;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return FALLBACK_PRESET_VENUES;
    const valid: PresetVenue[] = parsed
      .filter(
        (v): v is Partial<PresetVenue> & { name: string; latitude: number; longitude: number } =>
          Boolean(
            v &&
              typeof v.name === "string" &&
              v.name.trim().length > 0 &&
              typeof v.latitude === "number" &&
              Number.isFinite(v.latitude) &&
              typeof v.longitude === "number" &&
              Number.isFinite(v.longitude)
          )
      )
      .map((v, idx) => ({
        key:
          typeof v.key === "string" && v.key.trim()
            ? v.key.trim()
            : `custom_venue_${idx + 1}`,
        name: v.name.trim(),
        shortName:
          typeof v.shortName === "string" && v.shortName.trim()
            ? v.shortName.trim()
            : v.name.trim().split(",")[0],
        latitude: v.latitude,
        longitude: v.longitude,
        radiusMeters:
          typeof v.radiusMeters === "number" && Number.isFinite(v.radiusMeters)
            ? Math.min(250, Math.max(25, Math.round(v.radiusMeters)))
            : DEFAULT_GEOFENCE_RADIUS_METERS,
      }));
    return valid.length > 0 ? valid : FALLBACK_PRESET_VENUES;
  } catch {
    return FALLBACK_PRESET_VENUES;
  }
}

/**
 * Registry of preset swimming venues.
 * Can be customized privately via NEXT_PUBLIC_PRESET_VENUES JSON env var;
 * falls back to public demonstration pools when unconfigured.
 */
export const PRESET_VENUES: PresetVenue[] = parseEnvPresetVenues();

export const DEFAULT_VENUE: PresetVenue = PRESET_VENUES[0];

export const KNOWN_VENUES: Record<string, VenueLocation> = Object.fromEntries(
  PRESET_VENUES.map((v) => [
    v.key,
    {
      name: v.name,
      latitude: v.latitude,
      longitude: v.longitude,
      radiusMeters: v.radiusMeters,
    },
  ])
);

/**
 * Matches a location name string against coach-saved swimming places first,
 * then falls back to known squad preset venues.
 */
export function matchKnownVenueByName(
  locationName?: string | null,
  customVenues?: VenueCandidate[]
): VenueLocation | null {
  const loc = (locationName || "").toLowerCase().trim();
  if (!loc) return null;

  const normalizedCustom = (customVenues || []).map(normalizeVenueCandidate);
  const normalizedPresets = PRESET_VENUES.map(normalizeVenueCandidate);
  const poolList = [...normalizedCustom, ...normalizedPresets];

  // Pass 1: exact name or shortName match
  for (const venue of poolList) {
    const venueLower = venue.name.toLowerCase().trim();
    const shortLower = venue.shortName.toLowerCase().trim();
    if (loc === venueLower || (shortLower.length >= 3 && loc === shortLower)) {
      return {
        name: venue.name,
        latitude: venue.latitude,
        longitude: venue.longitude,
        radiusMeters: venue.radiusMeters,
      };
    }
  }

  // Pass 2: fuzzy substring / primary-token match
  for (const venue of poolList) {
    const venueLower = venue.name.toLowerCase().trim();
    const shortLower = venue.shortName.toLowerCase().trim();
    const primaryToken = venueLower.split(/[\s,]+/)[0] || "";
    if (
      loc.includes(venueLower) ||
      venueLower.includes(loc) ||
      (shortLower.length >= 4 && loc.includes(shortLower)) ||
      (primaryToken.length >= 4 && loc.includes(primaryToken))
    ) {
      return {
        name: venue.name,
        latitude: venue.latitude,
        longitude: venue.longitude,
        radiusMeters: venue.radiusMeters,
      };
    }
  }
  return null;
}

/**
 * STRICT venue resolver: returns null when the session has no explicit coordinates and its
 * venue_id / location text matches no saved or known venue. Used for anything security-relevant
 * (check-in) so a swimmer can never be verified against the wrong pool.
 */
export function resolveSessionVenue(
  session: SwimSession,
  customVenues?: VenueCandidate[]
): VenueLocation | null {
  if (session.latitude != null && session.longitude != null) {
    return {
      name: session.location,
      latitude: session.latitude,
      longitude: session.longitude,
      radiusMeters: clampGeofenceRadiusMeters(
        session.geofence_radius,
        DEFAULT_GEOFENCE_RADIUS_METERS
      ),
    };
  }

  if (session.venue_id && customVenues && customVenues.length > 0) {
    const byId = customVenues
      .map(normalizeVenueCandidate)
      .find((v) => v.id === session.venue_id);
    if (byId) {
      return {
        name: session.location || byId.name,
        latitude: byId.latitude,
        longitude: byId.longitude,
        radiusMeters:
          session.geofence_radius != null
            ? clampGeofenceRadiusMeters(session.geofence_radius, byId.radiusMeters)
            : byId.radiusMeters,
      };
    }
  }

  return matchKnownVenueByName(session.location, customVenues);
}

/**
 * Display-only helper (map preview, radar UI). Falls back to the default pool when the venue is
 * unknown. NEVER use this for validating a check-in - use resolveSessionVenue().
 */
export function getSessionVenueCoordinates(
  session: SwimSession,
  customVenues?: VenueCandidate[]
): VenueLocation {
  const resolved = resolveSessionVenue(session, customVenues);
  if (resolved) return resolved;
  if (customVenues && customVenues.length > 0) {
    const first = normalizeVenueCandidate(customVenues[0]);
    return {
      name: first.name,
      latitude: first.latitude,
      longitude: first.longitude,
      radiusMeters: first.radiusMeters,
    };
  }
  return DEFAULT_VENUE;
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
  customVenues?: VenueCandidate[];
}): GeofenceValidationResult {
  const {
    userLat,
    userLng,
    accuracy,
    clientTimestamp,
    session,
    bypassTimeWindowForDev,
    customVenues,
  } = params;
  const lateThreshold = Number.isFinite(params.lateThresholdMinutes)
    ? Math.max(0, params.lateThresholdMinutes as number)
    : DEFAULT_LATE_THRESHOLD_MINUTES;
  const venue = resolveSessionVenue(session, customVenues);

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
