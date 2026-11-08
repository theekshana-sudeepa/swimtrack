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
    // Royal College Aquatic Complex coordinates
    const royalLat = 6.9015;
    const royalLng = 79.8605;

    // 0 distance at the same point
    const zeroDist = calculateHaversineDistance(royalLat, royalLng, royalLat, royalLng);
    expect(zeroDist).toBe(0);

    // Small step (approx 15-20 meters away on the pool deck)
    const smallStep = calculateHaversineDistance(
      royalLat,
      royalLng,
      royalLat + 0.00015,
      royalLng + 0.00015
    );
    expect(smallStep).toBeGreaterThan(15);
    expect(smallStep).toBeLessThan(35);

    // Far away: Galle Face Green (~3.3 km away)
    const farDist = calculateHaversineDistance(royalLat, royalLng, 6.9271, 79.8458);
    expect(farDist).toBeGreaterThan(3000);
    expect(farDist).toBeLessThan(4000);
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
    expect(venue.name).toContain("Royal College");
    expect(venue.latitude).toBeCloseTo(6.9015, 3);
    expect(venue.radiusMeters).toBe(90);
  });

  it("rejects check-in if GPS accuracy is too coarse (>45m)", () => {
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
      userLat: 6.9015,
      userLng: 79.8605,
      accuracy: 65, // Too coarse (e.g. cellular tower estimate)
      clientTimestamp: Date.now(),
      session: mockSession,
      bypassTimeWindowForDev: true,
    });

    expect(res.isValid).toBe(false);
    expect(res.error).toContain("GPS accuracy is too low");
  });

  it("rejects check-in if user is outside the pool radius (>90m)", () => {
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

    // User is ~600m away (outside pool zone)
    const res = validateGeofenceCheckin({
      userLat: 6.9065,
      userLng: 79.8655,
      accuracy: 10,
      clientTimestamp: Date.now(),
      session: mockSession,
      bypassTimeWindowForDev: true,
    });

    expect(res.isValid).toBe(false);
    expect(res.error).toContain("You must be within 90m of the pool");
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

    // User is ~25m inside the pool complex
    const res = validateGeofenceCheckin({
      userLat: 6.9015 + 0.00015,
      userLng: 79.8605 + 0.00015,
      accuracy: 8,
      clientTimestamp: Date.now(),
      session: mockSession,
      bypassTimeWindowForDev: true,
    });

    expect(res.isValid).toBe(true);
    expect(res.distanceMeters).toBeLessThan(90);
    expect(res.status).toBeDefined();
    expect(res.reason).toContain("Self check-in via Geofence");
  });
});

