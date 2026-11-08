import { SwimSession, AttendanceStatus } from "@/types/database";
import { getCurrentColomboTime, parseTimeToMinutes } from "./attendance-calculator";

export interface VenueLocation {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

/**
 * Registry of known aquatic centers & swimming pools in Sri Lanka.
 * Default radius is 85-100m to comfortably encompass the pool deck,
 * spectator stands, and changing facilities while excluding neighboring houses/streets.
 */
export const KNOWN_VENUES: Record<string, VenueLocation> = {
  royal_college: {
    name: "Royal College Aquatic Complex, Colombo",
    latitude: 6.9015,
    longitude: 79.8605,
    radiusMeters: 90,
  },
  sugathadasa: {
    name: "Sugathadasa Stadium Swimming Pool, Colombo",
    latitude: 6.9472,
    longitude: 79.87,
    radiusMeters: 100,
  },
  bandaranayake: {
    name: "Bandaranayake College Swimming Pool Complex",
    latitude: 7.0917,
    longitude: 79.9996,
    radiusMeters: 85,
  },
  ananda_college: {
    name: "Ananda College Swimming Pool Complex, Colombo",
    latitude: 6.9242,
    longitude: 79.8728,
    radiusMeters: 85,
  },
  st_josephs: {
    name: "St. Joseph's College Swimming Pool, Colombo",
    latitude: 6.9208,
    longitude: 79.8617,
    radiusMeters: 85,
  },
  air_force_ratmalana: {
    name: "Air Force Swimming Pool Complex, Ratmalana",
    latitude: 6.8205,
    longitude: 79.8862,
    radiusMeters: 90,
  },
};

/**
 * Finds the venue coordinates for a session based on session attributes or location string.
 */
export function getSessionVenueCoordinates(session: SwimSession): VenueLocation {
  // If session has explicit coordinates, use those
  if (session.latitude && session.longitude) {
    return {
      name: session.location,
      latitude: session.latitude,
      longitude: session.longitude,
      radiusMeters: session.geofence_radius || 90,
    };
  }

  // Otherwise, match against known venue strings
  const loc = (session.location || "").toLowerCase();
  for (const venue of Object.values(KNOWN_VENUES)) {
    const venueLower = venue.name.toLowerCase();
    if (
      loc.includes(venueLower) ||
      venueLower.includes(loc) ||
      (loc.includes("royal") && venueLower.includes("royal")) ||
      (loc.includes("sugathadasa") && venueLower.includes("sugathadasa")) ||
      (loc.includes("bandaranayake") && venueLower.includes("bandaranayake")) ||
      (loc.includes("ananda") && venueLower.includes("ananda")) ||
      (loc.includes("joseph") && venueLower.includes("joseph"))
    ) {
      return venue;
    }
  }

  // Fallback to Royal College Aquatic Complex if no match
  return KNOWN_VENUES.royal_college;
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
  reason?: string;
  error?: string;
}

/**
 * Strict Server-Side Validation:
 * 1. Checks if the session is active today.
 * 2. Checks if current Colombo time is within the allowable session check-in window:
 *    [session.start_time - 30 mins, session.end_time + 15 mins].
 * 3. Enforces GPS accuracy threshold (rejects accuracy > 45m).
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
}): GeofenceValidationResult {
  const { userLat, userLng, accuracy, clientTimestamp, session, bypassTimeWindowForDev } = params;
  const venue = getSessionVenueCoordinates(session);

  // 1. Calculate distance on server
  const distanceMeters = calculateHaversineDistance(
    userLat,
    userLng,
    venue.latitude,
    venue.longitude
  );

  // 2. Accuracy check (anti-coarse / anti-IP spoofing)
  // High quality GPS is typically < 25m. Reject anything coarser than 45m.
  if (accuracy > 45) {
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
  if (!bypassTimeWindowForDev && timeDiffSec > 90) {
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
  const isLate = minutesLate > 10;
  const status: AttendanceStatus = isLate ? "late" : "present";

  const reason = isLate
    ? `Self check-in via Geofence (Late by ${minutesLate}m at ${colombo.time12}, ${distanceMeters}m from pool center)`
    : `Self check-in via Geofence (On time at ${colombo.time12}, ${distanceMeters}m from pool center)`;

  return {
    isValid: true,
    distanceMeters,
    radiusMeters: venue.radiusMeters,
    status,
    isLate,
    minutesLate,
    reason,
  };
}
