"use client";

import * as React from "react";
import {
  MapPin,
  Navigation,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Unlock,
  AlertTriangle,
  RefreshCw,
  Compass,
  Radio,
  Clock,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { SwimSession, AttendanceRecord, PoolVenue } from "@/types/database";
import {
  MAX_GPS_ACCURACY_METERS,
  getSessionVenueCoordinates,
  calculateHaversineDistance,
  VenueLocation,
} from "@/lib/geo-fence";
import {
  selfCheckInWithGeofenceAction,
  issueCheckinChallengeAction,
} from "@/actions/portal-actions";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { cn, formatTime } from "@/lib/utils";

interface PoolRadarCheckinProps {
  session: SwimSession;
  savedVenues?: PoolVenue[];
  token: string;
  existingAttendance?: AttendanceRecord | null;
  onCheckedIn?: (record: AttendanceRecord) => void;
}

type GpsState =
  | "prompt" // Haven't requested GPS yet
  | "searching" // Acquiring fix
  | "ready" // GPS acquired, inside or outside
  | "denied" // User denied location permission
  | "unavailable"; // Device has no GPS or error

export function PoolRadarCheckin({
  session,
  savedVenues = [],
  token,
  existingAttendance,
  onCheckedIn,
}: PoolRadarCheckinProps) {
  const venue = React.useMemo<VenueLocation>(() => {
    return getSessionVenueCoordinates(session, savedVenues);
  }, [session, savedVenues]);

  const [attendanceRecord, setAttendanceRecord] =
    React.useState<AttendanceRecord | null>(existingAttendance || null);

  React.useEffect(() => {
    if (existingAttendance) {
      setAttendanceRecord(existingAttendance);
    } else {
      setAttendanceRecord(null);
    }
  }, [existingAttendance]);

  // Check if already marked present or late
  const isAlreadyCheckedIn =
    attendanceRecord?.status === "present" ||
    attendanceRecord?.status === "late" ||
    existingAttendance?.status === "present" ||
    existingAttendance?.status === "late";
  const [gpsState, setGpsState] = React.useState<GpsState>("prompt");
  const [coords, setCoords] = React.useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  } | null>(null);
  const [distanceMeters, setDistanceMeters] = React.useState<number | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showTechInfo, setShowTechInfo] = React.useState(false);
  const [showPinPrompt, setShowPinPrompt] = React.useState(false);
  const [pinInput, setPinInput] = React.useState("");

  // Watch Position Handler
  const watchIdRef = React.useRef<number | null>(null);

  const startGpsWatch = React.useCallback(
    () => {
      if (!("geolocation" in navigator)) {
        setGpsState("unavailable");
        setErrorMessage("Geolocation is not supported by your browser.");
        return;
      }

      setGpsState("searching");
      setErrorMessage(null);

      // Clear any existing watch
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const dist = calculateHaversineDistance(
            latitude,
            longitude,
            venue.latitude,
            venue.longitude
          );

          setCoords({
            latitude,
            longitude,
            accuracy,
            timestamp: position.timestamp || Date.now(),
          });
          setDistanceMeters(dist);
          setGpsState("ready");
          setErrorMessage(null);
        },
        (error) => {
          console.warn("[PoolRadar] Geolocation error:", error);
          if (error.code === error.PERMISSION_DENIED) {
            setGpsState("denied");
            setErrorMessage(
              "Location permission denied. Please allow location in your browser settings to verify you are at the pool."
            );
          } else {
            setGpsState("unavailable");
            setErrorMessage("Unable to get accurate GPS lock. Please try outdoors.");
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0, // Never accept stale cached GPS
        }
      );
    },
    [venue]
  );

  // Cleanup watcher on unmount
  React.useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Compute geofence status
  const isInsideGeofence =
    distanceMeters !== null && distanceMeters <= venue.radiusMeters;
  const isAccuracyGood = coords !== null && coords.accuracy <= MAX_GPS_ACCURACY_METERS;
  const isPinSatisfied = !showPinPrompt || /^\d{4}$/.test(pinInput.trim());
  const isButtonEnabled =
    isInsideGeofence &&
    isAccuracyGood &&
    !isAlreadyCheckedIn &&
    !isSubmitting &&
    isPinSatisfied;

  /**
   * watchPosition only fires when the phone moves, so a swimmer standing still on the deck can
   * hold a reading that is minutes old. Always take a brand-new fix at the moment of check-in.
   */
  function getFreshPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        reject(new Error("Geolocation is not supported by your browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      });
    });
  }

  // Handle Check-in Submission
  async function handleCheckIn() {
    if (!coords || !isInsideGeofence) {
      toast.error("You must be physically at the pool to check in.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Brand-new GPS fix (never reuse a cached/watched reading)
      let fresh: GeolocationPosition;
      try {
        fresh = await getFreshPosition();
      } catch (geoErr) {
        const code = (geoErr as GeolocationPositionError)?.code;
        toast.error(
          code === 1
            ? "Location permission was denied. Enable it to check in."
            : "Could not get a fresh GPS fix. Move to open sky and try again."
        );
        return;
      }

      const { latitude, longitude, accuracy } = fresh.coords;
      const dist = calculateHaversineDistance(latitude, longitude, venue.latitude, venue.longitude);
      setCoords({ latitude, longitude, accuracy, timestamp: fresh.timestamp || Date.now() });
      setDistanceMeters(dist);

      if (accuracy > MAX_GPS_ACCURACY_METERS) {
        toast.error(
          `GPS accuracy is too low (±${Math.round(accuracy)}m). Step outside or closer to the open pool deck.`
        );
        return;
      }
      if (dist > venue.radiusMeters) {
        toast.error(`You are ${dist}m from the pool. Get within ${venue.radiusMeters}m to check in.`);
        return;
      }

      // 2. Server-issued, single-use challenge
      const challengeRes = await issueCheckinChallengeAction(token, session.id);
      if (!challengeRes.success) {
        if (challengeRes.needsLogin) {
          toast.error("Please sign in with your PIN again to check in.");
          window.location.href = "/portal";
          return;
        }
        toast.error(challengeRes.error);
        return;
      }

      if (challengeRes.requiresPin && !/^\d{4}$/.test(pinInput.trim())) {
        setShowPinPrompt(true);
        toast.info("Enter your 4-digit PIN below to confirm your check-in.");
        return;
      }

      // 3. Submit. The server re-verifies everything; position age is clock-skew independent.
      const res = await selfCheckInWithGeofenceAction(
        token,
        session.id,
        {
          latitude,
          longitude,
          accuracy,
          positionAgeMs: Math.max(0, Date.now() - (fresh.timestamp || Date.now())),
        },
        challengeRes.challenge,
        pinInput.trim() || undefined
      );

      if (res.success && res.record) {
        setAttendanceRecord(res.record);
        setShowPinPrompt(false);
        setPinInput("");
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
        });

        if (res.status === "late") {
          toast.warning(
            `Checked in as LATE (${res.minutesLate} mins late). Recorded on squad deck!`,
            { duration: 5000 }
          );
        } else {
          toast.success(
            "Checked In Successfully! You are marked PRESENT 🏊",
            { duration: 5000 }
          );
        }

        if (onCheckedIn) {
          onCheckedIn(res.record);
        }
      } else if ((res as { needsLogin?: boolean }).needsLogin) {
        toast.error("Please sign in with your PIN again to check in.");
        window.location.href = "/portal";
      } else if ((res as { needsPin?: boolean }).needsPin) {
        setShowPinPrompt(true);
        setPinInput("");
        toast.error(res.error || "Please enter your 4-digit PIN to check in.");
      } else {
        toast.error(res.error || "Check-in failed. Please try again.");
      }
    } catch {
      toast.error("An error occurred during check-in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Format distance for UI
  function formatDistance(m: number | null): string {
    if (m === null) return "--";
    if (m < 1000) return `${m}m`;
    return `${(m / 1000).toFixed(1)} km`;
  }

  return (
    <div
      id="pool-radar"
      className="scroll-mt-6 rounded-3xl border border-aqua/30 bg-card/90 backdrop-blur-md p-5 sm:p-6 shadow-xl space-y-5 relative overflow-hidden"
    >
      {/* Background Ambience Glow */}
      <div
        className={cn(
          "absolute -right-16 -top-16 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-all duration-700",
          isAlreadyCheckedIn
            ? "bg-seafoam/25"
            : isInsideGeofence
            ? "bg-aqua/25 animate-pulse"
            : "bg-amber-500/10"
        )}
      />

      {/* Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-border/80 relative z-10">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shadow-inner",
              isAlreadyCheckedIn
                ? "bg-seafoam/20 text-seafoam border border-seafoam/40"
                : isInsideGeofence
                ? "bg-aqua/20 text-aqua border border-aqua/40 animate-pulse"
                : "bg-secondary text-muted-foreground border border-border"
            )}
          >
            {isAlreadyCheckedIn ? (
              <CheckCircle2 className="w-4 h-4 text-seafoam" />
            ) : (
              <Radio className="w-4 h-4" />
            )}
          </div>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-foreground flex items-center gap-1.5">
              <span>Pool Geofence Radar</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                Live GPS
              </span>
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {venue.name}
            </p>
          </div>
        </div>

        {/* Info toggle */}
        <button
          type="button"
          onClick={() => setShowTechInfo((v) => !v)}
          className="text-muted-foreground hover:text-foreground text-xs p-1.5 rounded-lg hover:bg-secondary transition-colors"
          title="How does legit geofencing work?"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Technical Legit Info Box (Collapsible) */}
      {showTechInfo && (
        <div className="p-3.5 rounded-2xl bg-secondary/50 border border-border text-[11px] text-muted-foreground space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-1.5 font-bold text-foreground text-xs">
            <ShieldCheck className="w-4 h-4 text-seafoam" />
            <span>Anti-Cheat &amp; Legit Enforcement (&ldquo;No Hora&rdquo;)</span>
          </div>
          <p className="leading-relaxed">
            Attendance unlocks automatically <strong>only when your phone physically arrives within {venue.radiusMeters}m</strong> of the swimming pool complex.
          </p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground/90 pl-1">
            <li><strong>Server-side Haversine Formula:</strong> The distance is recalculated on the backend server; client GPS coordinates cannot be faked via simple browser edits.</li>
            <li><strong>Precision GPS Only:</strong> Coarse tower signals or mock locations with &gt;{MAX_GPS_ACCURACY_METERS}m error are rejected.</li>
            <li><strong>Server Clock:</strong> On-time vs late status is strictly determined by server time (Asia/Colombo), ignoring your device clock.</li>
          </ul>
        </div>
      )}

      {/* Active State 1: Already Checked In */}
      {isAlreadyCheckedIn ? (
        <div className="p-4 sm:p-5 rounded-2xl bg-seafoam/10 border border-seafoam/30 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-seafoam/20 text-seafoam flex items-center justify-center shrink-0 border border-seafoam/40">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-foreground">
                  You Are Checked In!
                </span>
                <span
                  className={cn(
                    "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border",
                    attendanceRecord?.status === "present"
                      ? "bg-seafoam/20 text-seafoam border-seafoam/30"
                      : "bg-amber-400/20 text-amber-300 border-amber-400/30"
                  )}
                >
                  {attendanceRecord?.status === "present" ? "Present (On-Time)" : "Late Arrival"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {attendanceRecord?.notes || "Verified on pool deck via Geofence."}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-seafoam/20 flex flex-wrap items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-seafoam" />
              <span>Marked at: {attendanceRecord?.marked_at ? new Date(attendanceRecord.marked_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Today"}</span>
            </span>
            <span className="flex items-center gap-1 font-semibold text-seafoam">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Squad Deck Verified</span>
            </span>
          </div>
        </div>
      ) : (
        /* Active State 2: Not Yet Checked In */
        <div className="space-y-4">
          {/* Radar Radar Status Card */}
          <div className="p-4 rounded-2xl bg-secondary/40 border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {/* Radar Pulsing Animation Circle */}
              <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                {gpsState === "ready" && isInsideGeofence ? (
                  <>
                    <span className="absolute inline-flex h-full w-full rounded-full bg-aqua opacity-40 animate-ping" />
                    <div className="relative w-10 h-10 rounded-full bg-gradient-to-tr from-aqua to-seafoam text-ocean-950 flex items-center justify-center font-black shadow-lg">
                      <Unlock className="w-5 h-5 text-ocean-950" />
                    </div>
                  </>
                ) : gpsState === "ready" && !isInsideGeofence ? (
                  <div className="w-10 h-10 rounded-full bg-secondary border border-border text-muted-foreground flex items-center justify-center">
                    <Lock className="w-5 h-5" />
                  </div>
                ) : gpsState === "searching" ? (
                  <>
                    <span className="absolute inline-flex h-full w-full rounded-full bg-aqua/50 animate-ping" />
                    <div className="w-10 h-10 rounded-full bg-aqua/20 text-aqua flex items-center justify-center border border-aqua/40">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    </div>
                  </>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-secondary border border-border text-muted-foreground flex items-center justify-center">
                    <Navigation className="w-5 h-5 text-aqua" />
                  </div>
                )}
              </div>

              {/* Status Text & Dynamic Distance */}
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-foreground">
                    {gpsState === "ready"
                      ? isInsideGeofence
                        ? "Inside Pool Grounds 🎯"
                        : "Outside Pool Premises 📍"
                      : gpsState === "searching"
                      ? "Acquiring High-Accuracy GPS..."
                      : gpsState === "denied"
                      ? "Location Permission Needed"
                      : "GPS Radar Idle"}
                  </span>

                  {gpsState === "ready" && (
                    <span
                      className={cn(
                        "text-[10px] font-extrabold px-2 py-0.5 rounded-full border",
                        isInsideGeofence
                          ? "bg-seafoam/20 text-seafoam border-seafoam/30"
                          : "bg-amber-400/20 text-amber-300 border-amber-400/30"
                      )}
                    >
                      {formatDistance(distanceMeters)} away
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground leading-snug">
                  {gpsState === "ready"
                    ? isInsideGeofence
                      ? `Verified at ${distanceMeters}m from pool center (±${Math.round(coords?.accuracy || 0)}m GPS accuracy). Ready to check in!`
                      : `You must arrive within ${venue.radiusMeters}m of ${venue.name}. The button will enable automatically.`
                    : gpsState === "searching"
                    ? "Locking onto satellites with maximum accuracy..."
                    : gpsState === "denied"
                    ? "Please enable device location to mark attendance."
                    : "Tap below to activate your phone's GPS radar."}
                </p>
              </div>
            </div>

            {/* Turn On / Refresh GPS Button */}
            {gpsState === "prompt" ? (
              <button
                type="button"
                onClick={() => startGpsWatch()}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 border border-aqua/30 text-aqua font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
              >
                <Compass className="w-4 h-4 text-aqua animate-spin-slow" />
                <span>Turn On Radar</span>
              </button>
            ) : gpsState === "ready" ? (
              <button
                type="button"
                onClick={() => startGpsWatch()}
                className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-secondary/60 hover:bg-secondary border border-border text-muted-foreground hover:text-foreground text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors self-start sm:self-center"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh GPS</span>
              </button>
            ) : null}
          </div>

          {/* Error notice if any */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-coral/10 border border-coral/30 text-coral text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 4-Digit PIN Confirmation (Anti-Buddy-Checkin) */}
          {showPinPrompt && !isAlreadyCheckedIn && (
            <div className="p-3.5 rounded-2xl border border-aqua/40 bg-ocean-900/50 space-y-2">
              <label className="block text-xs font-bold text-foreground">
                Confirm your 4-digit PIN to complete check-in
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoFocus
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-center tracking-[0.5em] font-black text-base text-foreground focus:outline-none focus:ring-2 focus:ring-aqua"
              />
              <p className="text-[11px] text-muted-foreground">
                Protects your pass against buddy check-ins. Each phone can only check in one swimmer per session.
              </p>
            </div>
          )}

          {/* MAIN ATTENDANCE ACTION BUTTON */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              disabled={!isButtonEnabled}
              onClick={handleCheckIn}
              className={cn(
                "w-full py-4 px-6 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 transition-all shadow-xl active:scale-[0.98]",
                isButtonEnabled
                  ? "bg-gradient-to-r from-aqua to-seafoam text-ocean-950 hover:opacity-95 ring-4 ring-aqua/20 shadow-aqua/25 animate-pulse"
                  : "bg-secondary/70 border border-border/80 text-muted-foreground/60 cursor-not-allowed"
              )}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-ocean-950" />
                  <span>Submitting & Verifying with Pool Satellite...</span>
                </>
              ) : isButtonEnabled ? (
                <>
                  <Sparkles className="w-4 h-4 fill-ocean-950" />
                  <span>Mark Present (Inside Pool Zone 🏊)</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-muted-foreground/50" />
                  <span>
                    {gpsState === "prompt"
                      ? "Turn On Radar Above to Enable Check-In"
                      : !isInsideGeofence
                      ? `Locked — Arrive at Pool to Enable (${formatDistance(distanceMeters)})`
                      : "Verifying GPS Accuracy..."}
                  </span>
                </>
              )}
            </button>

            {/* Explanation footer under button */}
            <div className="text-center text-[11px] text-muted-foreground/75 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-seafoam" />
              <span>
                {isInsideGeofence
                  ? "Location verified via server-side Haversine formula."
                  : "Button activates automatically once phone location reaches the pool."}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
