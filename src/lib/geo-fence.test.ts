import { describe, it, expect } from "vitest";
import {
  calculateHaversineDistance,
  KNOWN_VENUES,
  getSessionVenueCoordinates,
  validateGeofenceCheckin,
  DEFAULT_GEOFENCE_RADIUS_METERS,
} from "./geo-fence";
import { SwimSession } from "@/types/database";
import { parseLateInfo } from "./attendance-calculator";

describe("Geofence Calculations & Anti-Cheat Rules", () => {
  it("calculates accurate distances using the Haversine formula", () => {
    // Royal College Aquatic Complex demo coordinates
    const primaryLat = 6.9056;
    const primaryLng = 79.8614;

    // 0 distance at the same point
    const zeroDist = calculateHaversineDistance(primaryLat, primaryLng, primaryLat, primaryLng);
    expect(zeroDist).toBe(0);

    // Small step (approx 15-25 meters away on the pool deck)
    const smallStep = calculateHaversineDistance(
      primaryLat,
      primaryLng,
      primaryLat + 0.00015,
      primaryLng + 0.00015
    );
    expect(smallStep).toBeGreaterThan(15);
    expect(smallStep).toBeLessThan(35);

    // Sugathadasa Stadium Swimming Pool (~4.9 km away)
    const farDist = calculateHaversineDistance(primaryLat, primaryLng, 6.9491, 79.8689);
    expect(farDist).toBeGreaterThan(3500);
    expect(farDist).toBeLessThan(6000);
  });

  it("resolves venue coordinates from session location text", () => {
    const mockSession: SwimSession = {
      id: "sess-1",
      title: "Morning Squad",
      date: "2026-11-08",
      start_time: "06:30:00",
      end_time: "08:00:00",
      location: "Royal College Aquatic Complex, Colombo",
      status: "scheduled",
      is_finalized: false,
    };

    const venue = getSessionVenueCoordinates(mockSession);
    expect(venue.name).toContain("Royal College Aquatic Complex");
    expect(venue.latitude).toBeCloseTo(6.9056, 3);
    expect(venue.radiusMeters).toBe(DEFAULT_GEOFENCE_RADIUS_METERS);
  });

  it("resolves Sugathadasa Stadium Swimming Pool Colombo coordinates", () => {
    const mockSession: SwimSession = {
      id: "sess-2",
      title: "Evening Drills",
      date: "2026-11-08",
      start_time: "17:00:00",
      end_time: "18:30:00",
      location: "Sugathadasa Stadium Swimming Pool, Colombo",
      status: "scheduled",
      is_finalized: false,
    };

    const venue = getSessionVenueCoordinates(mockSession);
    expect(venue.name).toContain("Sugathadasa");
    expect(venue.latitude).toBeCloseTo(6.9491, 3);
    expect(venue.radiusMeters).toBe(DEFAULT_GEOFENCE_RADIUS_METERS);
  });

  it("rejects check-in if GPS accuracy is too coarse (>50m)", () => {
    const mockSession: SwimSession = {
      id: "sess-1",
      title: "Morning Squad",
      date: "2026-11-08",
      start_time: "06:30:00",
      end_time: "08:00:00",
      location: "Royal College Aquatic Complex, Colombo",
      status: "scheduled",
      is_finalized: false,
    };

    const res = validateGeofenceCheckin({
      userLat: 6.9056,
      userLng: 79.8614,
      accuracy: 65, // Too coarse (e.g. cellular tower estimate)
      clientTimestamp: Date.now(),
      session: mockSession,
      bypassTimeWindowForDev: true,
    });

    expect(res.isValid).toBe(false);
    expect(res.error).toContain("GPS accuracy is too low");
  });

  it("rejects check-in if user is outside the pool radius", () => {
    const mockSession: SwimSession = {
      id: "sess-1",
      title: "Morning Squad",
      date: "2026-11-08",
      start_time: "06:30:00",
      end_time: "08:00:00",
      location: "Royal College Aquatic Complex, Colombo",
      status: "scheduled",
      is_finalized: false,
    };

    // User is ~125m away (outside the 75m pool zone)
    const res = validateGeofenceCheckin({
      userLat: 6.9056 + 0.0008,
      userLng: 79.8614 + 0.0008,
      accuracy: 10,
      clientTimestamp: Date.now(),
      session: mockSession,
      bypassTimeWindowForDev: true,
    });

    expect(res.isValid).toBe(false);
    expect(res.error).toContain("You must be within 75m of the pool");
  });

  it("accepts check-in when user is inside the pool zone with high accuracy", () => {
    const mockSession: SwimSession = {
      id: "sess-1",
      title: "Morning Squad",
      date: "2026-11-08",
      start_time: "06:30:00",
      end_time: "08:00:00",
      location: "Royal College Aquatic Complex, Colombo",
      status: "scheduled",
      is_finalized: false,
    };

    // User is ~15m inside the pool complex
    const res = validateGeofenceCheckin({
      userLat: 6.9056 + 0.0001,
      userLng: 79.8614 + 0.0001,
      accuracy: 8,
      clientTimestamp: Date.now(),
      session: mockSession,
      bypassTimeWindowForDev: true,
    });

    expect(res.isValid).toBe(true);
    expect(res.distanceMeters).toBeLessThan(DEFAULT_GEOFENCE_RADIUS_METERS);
    expect(res.status).toBeDefined();
    expect(res.reason).toContain("Self check-in via Geofence");
  });

  it("rejects check-in when the session venue is unknown (no fallback to another pool)", () => {
    const unknownVenue: SwimSession = {
      id: "sess-x",
      title: "Away Meet",
      date: "2026-11-08",
      start_time: "06:30:00",
      end_time: "08:00:00",
      location: "Some Other Pool, Kandy",
      status: "scheduled",
      is_finalized: false,
    };

    // Standing exactly on the DEFAULT pool must NOT validate an away-venue session
    const res = validateGeofenceCheckin({
      userLat: 6.9056,
      userLng: 79.8614,
      accuracy: 8,
      clientTimestamp: Date.now(),
      session: unknownVenue,
      bypassTimeWindowForDev: true,
    });

    expect(res.isValid).toBe(false);
    expect(res.error).toContain("no verified pool location");
  });

  it("accepts a 40m-accurate reading that is inside the radius (real-world phone GPS)", () => {
    const session: SwimSession = {
      id: "sess-r",
      title: "Morning Squad",
      date: "2026-11-08",
      start_time: "06:30:00",
      end_time: "08:00:00",
      location: "Royal College Aquatic Complex, Colombo",
      status: "scheduled",
      is_finalized: false,
    };
    const res = validateGeofenceCheckin({
      userLat: 6.9056 + 0.0003,
      userLng: 79.8614,
      accuracy: 40,
      clientTimestamp: Date.now(),
      session,
      bypassTimeWindowForDev: true,
    });
    expect(res.isValid).toBe(true);
  });

  it("rejects malformed coordinates (NaN / out of range)", () => {
    const session: SwimSession = {
      id: "sess-n",
      title: "Morning Squad",
      date: "2026-11-08",
      start_time: "06:30:00",
      end_time: "08:00:00",
      location: "Royal College Aquatic Complex, Colombo",
      status: "scheduled",
      is_finalized: false,
    };
    for (const bad of [
      { userLat: NaN, userLng: 79.8614 },
      { userLat: 6.9056, userLng: 999 },
    ]) {
      const res = validateGeofenceCheckin({
        ...bad,
        accuracy: 8,
        clientTimestamp: Date.now(),
        session,
        bypassTimeWindowForDev: true,
      });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("Invalid location reading");
    }
  });

  it("rejects a stale GPS reading (replay protection)", () => {
    const session: SwimSession = {
      id: "sess-s",
      title: "Morning Squad",
      date: "2026-11-08",
      start_time: "06:30:00",
      end_time: "08:00:00",
      location: "Royal College Aquatic Complex, Colombo",
      status: "scheduled",
      is_finalized: false,
    };
    const res = validateGeofenceCheckin({
      userLat: 6.9056,
      userLng: 79.8614,
      accuracy: 8,
      clientTimestamp: Date.now() - 5 * 60_000,
      session,
    });
    expect(res.isValid).toBe(false);
    expect(res.error).toContain("expired");
  });

  it("formats late GPS check-in notes in the exact format the coach late editor parses", () => {
    const earlyMorningSession: SwimSession = {
      id: "sess-late",
      title: "Sunrise Squad",
      date: "2026-11-08",
      start_time: "00:00:00", // guarantees current Colombo time is past start
      end_time: "23:59:00",
      location: "Royal College Aquatic Complex, Colombo",
      status: "scheduled",
      is_finalized: false,
    };

    const res = validateGeofenceCheckin({
      userLat: 6.9056,
      userLng: 79.8614,
      accuracy: 8,
      clientTimestamp: Date.now(),
      session: earlyMorningSession,
      bypassTimeWindowForDev: true,
      lateThresholdMinutes: 0,
    });

    expect(res.isValid).toBe(true);
    expect(res.status).toBe("late");
    expect(res.note).toBeDefined();

    const parsed = parseLateInfo(res.note);
    expect(parsed).not.toBeNull();
    expect(parsed?.minutesLate).toBe(res.minutesLate);
    expect(parsed?.reason).toContain("GPS check-in");
  });
});
