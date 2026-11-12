import { describe, it, expect } from "vitest";
import {
  calculateHaversineDistance,
  KNOWN_VENUES,
  getSessionVenueCoordinates,
  validateGeofenceCheckin,
} from "./geo-fence";
import { SwimSession } from "@/types/database";

describe("Geofence Calculations & Anti-Cheat Rules", () => {
  it("calculates accurate distances using the Haversine formula", () => {
    // Bandaranayake College Swimming Pool Complex coordinates
    const bndLat = 7.0917;
    const bndLng = 79.9996;

    // 0 distance at the same point
    const zeroDist = calculateHaversineDistance(bndLat, bndLng, bndLat, bndLng);
    expect(zeroDist).toBe(0);

    // Small step (approx 15-20 meters away on the pool deck)
    const smallStep = calculateHaversineDistance(
      bndLat,
      bndLng,
      bndLat + 0.00015,
      bndLng + 0.00015
    );
    expect(smallStep).toBeGreaterThan(15);
    expect(smallStep).toBeLessThan(35);

    // Ranaviru Apparels Yakkala (~4.2 km away)
    const farDist = calculateHaversineDistance(bndLat, bndLng, 7.0785, 80.036);
    expect(farDist).toBeGreaterThan(3500);
    expect(farDist).toBeLessThan(5000);
  });

  it("resolves venue coordinates from session location text", () => {
    const mockSession: SwimSession = {
      id: "sess-1",
      title: "Morning Squad",
      date: "2026-11-08",
      start_time: "06:30:00",
      end_time: "08:00:00",
      location: "Bandaranayake College Swimming Pool Complex, Gampaha",
      status: "scheduled",
      is_finalized: false,
    };

    const venue = getSessionVenueCoordinates(mockSession);
    expect(venue.name).toContain("Bandaranayake");
    expect(venue.latitude).toBeCloseTo(7.0917, 3);
    expect(venue.radiusMeters).toBe(30);
  });

  it("resolves Ranaviru Apparels Swimming Pool Yakkala coordinates", () => {
    const mockSession: SwimSession = {
      id: "sess-2",
      title: "Evening Drills",
      date: "2026-11-08",
      start_time: "17:00:00",
      end_time: "18:30:00",
      location: "Ranaviru Apparels Swimming Pool, Yakkala",
      status: "scheduled",
      is_finalized: false,
    };

    const venue = getSessionVenueCoordinates(mockSession);
    expect(venue.name).toContain("Ranaviru");
    expect(venue.latitude).toBeCloseTo(7.0785, 3);
    expect(venue.radiusMeters).toBe(30);
  });

  it("rejects check-in if GPS accuracy is too coarse (>45m)", () => {
    const mockSession: SwimSession = {
      id: "sess-1",
      title: "Morning Squad",
      date: "2026-11-08",
      start_time: "06:30:00",
      end_time: "08:00:00",
      location: "Bandaranayake College Swimming Pool Complex, Gampaha",
      status: "scheduled",
      is_finalized: false,
    };

    const res = validateGeofenceCheckin({
      userLat: 7.0917,
      userLng: 79.9996,
      accuracy: 65, // Too coarse (e.g. cellular tower estimate)
      clientTimestamp: Date.now(),
      session: mockSession,
      bypassTimeWindowForDev: true,
    });

    expect(res.isValid).toBe(false);
    expect(res.error).toContain("GPS accuracy is too low");
  });

  it("rejects check-in if user is outside the 30m pool radius", () => {
    const mockSession: SwimSession = {
      id: "sess-1",
      title: "Morning Squad",
      date: "2026-11-08",
      start_time: "06:30:00",
      end_time: "08:00:00",
      location: "Bandaranayake College Swimming Pool Complex, Gampaha",
      status: "scheduled",
      is_finalized: false,
    };

    // User is ~60m away (outside 30m pool zone)
    const res = validateGeofenceCheckin({
      userLat: 7.0917 + 0.0005,
      userLng: 79.9996 + 0.0005,
      accuracy: 10,
      clientTimestamp: Date.now(),
      session: mockSession,
      bypassTimeWindowForDev: true,
    });

    expect(res.isValid).toBe(false);
    expect(res.error).toContain("You must be within 30m of the pool");
  });

  it("accepts check-in when user is inside the 30m pool zone with high accuracy", () => {
    const mockSession: SwimSession = {
      id: "sess-1",
      title: "Morning Squad",
      date: "2026-11-08",
      start_time: "06:30:00",
      end_time: "08:00:00",
      location: "Bandaranayake College Swimming Pool Complex, Gampaha",
      status: "scheduled",
      is_finalized: false,
    };

    // User is ~15m inside the pool complex
    const res = validateGeofenceCheckin({
      userLat: 7.0917 + 0.0001,
      userLng: 79.9996 + 0.0001,
      accuracy: 8,
      clientTimestamp: Date.now(),
      session: mockSession,
      bypassTimeWindowForDev: true,
    });

    expect(res.isValid).toBe(true);
    expect(res.distanceMeters).toBeLessThan(30);
    expect(res.status).toBeDefined();
    expect(res.reason).toContain("Self check-in via Geofence");
  });
});

