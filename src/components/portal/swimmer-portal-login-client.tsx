"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Waves,
  Lock,
  ShieldCheck,
  Search,
  Sparkles,
  ArrowRight,
  X,
  Eye,
  EyeOff,
  LogOut,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Smartphone,
} from "lucide-react";
import { SwimTrackLogo } from "@/components/brand/logo";
import {
  loginSwimmerWithPinAction,
  setupSwimmerPinAction,
  logoutSwimmerAction,
} from "@/actions/portal-actions";
import { cn, getInitials } from "@/lib/utils";
import confetti from "canvas-confetti";
import { toast } from "sonner";

export interface PortalSquadMember {
  id: string;
  full_name: string;
  nickname?: string | null;
  avatar_color?: string;
  hasPin: boolean;
}

export interface RememberedSwimmer {
  id: string;
  full_name: string;
  nickname?: string | null;
  avatar_color?: string;
  token: string;
}

interface SwimmerPortalLoginClientProps {
  initialMembers: PortalSquadMember[];
  rememberedSwimmer?: RememberedSwimmer | null;
}

export function SwimmerPortalLoginClient({
  initialMembers,
  rememberedSwimmer: initialRemembered,
}: SwimmerPortalLoginClientProps) {
  const router = useRouter();
  const [members, setMembers] = React.useState<PortalSquadMember[]>(initialMembers);
  const [remembered, setRemembered] = React.useState<RememberedSwimmer | null>(
    initialRemembered || null
  );
  const [search, setSearch] = React.useState("");

  // Modal State
  const [activeSwimmer, setActiveSwimmer] = React.useState<PortalSquadMember | null>(null);
  const [mode, setMode] = React.useState<"login" | "setup">("login");
  const [pinDigits, setPinDigits] = React.useState<string[]>(["", "", "", ""]);
  const [confirmDigits, setConfirmDigits] = React.useState<string[]>(["", "", "", ""]);
  const [showPin, setShowPin] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Refs for auto-focusing 4-digit PIN boxes
  const pinInputRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const confirmInputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  // Filter squad members
  const filteredMembers = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.full_name.toLowerCase().includes(q) ||
        (m.nickname && m.nickname.toLowerCase().includes(q))
    );
  }, [members, search]);

  // Open modal when tapping a squad member
  function handleSelectSwimmer(swimmer: PortalSquadMember) {
    setActiveSwimmer(swimmer);
    setMode(swimmer.hasPin ? "login" : "setup");
    setPinDigits(["", "", "", ""]);
    setConfirmDigits(["", "", "", ""]);
    setErrorMessage(null);
    setShowPin(false);

    // Auto-focus first input box after modal opens
    setTimeout(() => {
      pinInputRefs.current[0]?.focus();
    }, 100);
  }

  function handleCloseModal() {
    if (isSubmitting) return;
    setActiveSwimmer(null);
    setPinDigits(["", "", "", ""]);
    setConfirmDigits(["", "", "", ""]);
    setErrorMessage(null);
  }

  // Handle single digit PIN changes with auto-advancing focus
  function handleDigitChange(
    index: number,
    value: string,
    isConfirm = false
  ) {
    const digits = isConfirm ? [...confirmDigits] : [...pinDigits];
    const refs = isConfirm ? confirmInputRefs : pinInputRefs;

    // Filter to last entered digit
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length === 0) {
      digits[index] = "";
      if (isConfirm) setConfirmDigits(digits);
      else setPinDigits(digits);
      return;
    }

    // Support pasting 4 digits at once
    if (cleaned.length >= 4) {
      const four = cleaned.slice(0, 4).split("");
      if (isConfirm) setConfirmDigits(four);
      else setPinDigits(four);
      refs.current[3]?.focus();
      return;
    }

    digits[index] = cleaned[cleaned.length - 1];
    if (isConfirm) setConfirmDigits(digits);
    else setPinDigits(digits);

    // Auto-advance to next box if available
    if (index < 3 && cleaned.length > 0) {
      refs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number,
    isConfirm = false
  ) {
    const digits = isConfirm ? confirmDigits : pinDigits;
    const refs = isConfirm ? confirmInputRefs : pinInputRefs;

    if (e.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }

  // Submit PIN verification or setup
  async function handleSubmitPin(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSwimmer || isSubmitting) return;

    const pin = pinDigits.join("");
    if (pin.length !== 4) {
      setErrorMessage("Please enter all 4 digits of your PIN.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (mode === "setup") {
        const confirmPin = confirmDigits.join("");
        if (confirmPin.length !== 4) {
          setErrorMessage("Please confirm all 4 digits of your PIN.");
          setIsSubmitting(false);
          return;
        }

        if (pin !== confirmPin) {
          setErrorMessage("PINs do not match. Please re-enter identical 4-digit PINs.");
          setIsSubmitting(false);
          return;
        }

        const res = await setupSwimmerPinAction(activeSwimmer.id, pin, confirmPin);
        if (!res.success || !res.token) {
          setErrorMessage(res.error || "Failed to configure PIN.");
          setIsSubmitting(false);
          return;
        }

        // Celebrate setup!
        try {
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.6 },
          });
        } catch {
          // ignore
        }

        try {
          localStorage.setItem("swimtrack_swimmer_token", res.token);
        } catch {
          // ignore
        }

        toast.success(`Welcome to SwimTrack, ${res.swimmerName}! Security PIN created.`);
        router.push(`/portal/${encodeURIComponent(res.token)}`);
      } else {
        // Login mode
        const res = await loginSwimmerWithPinAction(activeSwimmer.id, pin);
        if (!res.success || !res.token) {
          if (res.needsSetup) {
            setMode("setup");
            setErrorMessage("No PIN found. Please create your 4-digit security PIN now.");
            setIsSubmitting(false);
            return;
          }
          setErrorMessage(res.error || "Incorrect PIN. Please try again.");
          setIsSubmitting(false);
          // Highlight and refocus PIN inputs
          pinInputRefs.current[0]?.focus();
          return;
        }

        try {
          localStorage.setItem("swimtrack_swimmer_token", res.token);
        } catch {
          // ignore
        }

        toast.success(`Access granted! Welcome, ${res.swimmerName}.`);
        router.push(`/portal/${encodeURIComponent(res.token)}`);
      }
    } catch (err) {
      setErrorMessage("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  }

  // Switch remembered swimmer on this device
  async function handleSwitchSwimmer() {
    try {
      await logoutSwimmerAction();
      localStorage.removeItem("swimtrack_swimmer_token");
    } catch {
      // ignore
    }
    setRemembered(null);
    toast.info("Swimmer profile disconnected from this browser.");
  }


  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-aqua selection:text-ocean-950">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <Link href="/" className="hover:opacity-90 transition-opacity">
          <SwimTrackLogo size="md" />
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border bg-secondary/40 hover:bg-secondary flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5 text-aqua" />
            <span>Admin Portal</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Hero Banner */}
        <div className="text-center space-y-3 max-w-xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border border-aqua/30 bg-aqua/5 text-aqua">
            <ShieldCheck className="w-3.5 h-3.5 text-seafoam" />
            <span>Personal 4-Digit Security PIN</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
            Swimmer Pass Access 🏊
          </h1>

          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Select your squad profile and enter your private 4-digit PIN. Only you can view your personal attendance rate, track your streak, and submit 1-tap RSVPs.
          </p>
        </div>

        {/* Quick Resume Card if this device already has an active session */}
        {remembered && (
          <div className="p-4 sm:p-5 rounded-2xl border-2 border-aqua/40 bg-gradient-to-r from-aqua/10 via-card to-card shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-ocean-900 border border-aqua text-aqua font-black text-lg flex items-center justify-center shrink-0">
                {getInitials(remembered.full_name)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-seafoam/20 text-seafoam border border-seafoam/40">
                    Saved on this device
                  </span>
                </div>
                <h3 className="text-base font-black text-foreground mt-0.5">
                  {remembered.nickname
                    ? `${remembered.full_name} ("${remembered.nickname}")`
                    : remembered.full_name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Your private Swimmer Pass is ready to load.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleSwitchSwimmer}
                className="px-3 py-2 rounded-xl border border-border bg-secondary/50 hover:bg-secondary text-xs font-semibold text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5"
                title="Switch Swimmer Profile"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Switch</span>
              </button>

              <button
                type="button"
                onClick={() => router.push(`/portal/${encodeURIComponent(remembered.token)}`)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-aqua to-seafoam text-ocean-950 font-black text-xs transition-all shadow-md hover:opacity-95 active:scale-95 flex items-center gap-1.5"
              >
                <span>Open Pass</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Squad Selection Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
                <span>Squad Members</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                  {filteredMembers.length}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Tap your name below to unlock your pass.
              </p>
            </div>

            {/* Search Filter */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your name..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-border bg-card text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-aqua placeholder:text-muted-foreground/60 transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Members Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filteredMembers.map((swimmer) => {
              const displayName = swimmer.nickname
                ? `${swimmer.full_name}`
                : swimmer.full_name;

              return (
                <button
                  key={swimmer.id}
                  type="button"
                  onClick={() => handleSelectSwimmer(swimmer)}
                  className="p-4 rounded-2xl border border-border bg-card hover:border-aqua/50 hover:bg-card/90 transition-all duration-150 text-left group flex items-center justify-between gap-3 shadow-sm hover:shadow-md active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-ocean-900 border border-border group-hover:border-aqua/50 text-aqua flex items-center justify-center font-extrabold text-sm shrink-0 transition-colors shadow-inner">
                      {getInitials(swimmer.full_name)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-sm text-foreground truncate group-hover:text-aqua transition-colors">
                        {displayName}
                      </div>
                      {swimmer.nickname && (
                        <div className="text-xs text-muted-foreground font-medium truncate">
                          &ldquo;{swimmer.nickname}&rdquo;
                        </div>
                      )}
                      <div className="mt-1 flex items-center gap-1.5">
                        {swimmer.hasPin ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/80 text-muted-foreground border border-border">
                            <Lock className="w-2.5 h-2.5 text-aqua" />
                            <span>PIN Protected</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-seafoam/15 text-seafoam border border-seafoam/40 animate-pulse">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>Set 4-Digit PIN</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-xl bg-secondary/50 group-hover:bg-aqua group-hover:text-ocean-950 text-muted-foreground flex items-center justify-center shrink-0 transition-all">
                    <KeyRound className="w-4 h-4" />
                  </div>
                </button>
              );
            })}
          </div>

          {filteredMembers.length === 0 && (
            <div className="text-center py-12 p-6 rounded-2xl border border-dashed border-border bg-card/40 space-y-2">
              <Search className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
              <p className="text-sm font-semibold text-foreground">
                No squad member found for &ldquo;{search}&rdquo;
              </p>
              <p className="text-xs text-muted-foreground">
                Check spelling or clear the search to view all squad members.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* PIN Authentication & Setup Modal */}
      {activeSwimmer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 relative animate-in zoom-in-95 duration-150">
            {/* Close Modal Button */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleCloseModal}
              className="absolute top-5 right-5 text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Profile Header in Modal */}
            <div className="flex items-center gap-3.5 pr-8">
              <div className="w-14 h-14 rounded-2xl bg-ocean-900 border-2 border-aqua text-aqua flex items-center justify-center font-black text-lg shadow-inner shrink-0">
                {getInitials(activeSwimmer.full_name)}
              </div>
              <div>
                <h3 className="text-lg font-black text-foreground">
                  {activeSwimmer.nickname
                    ? `${activeSwimmer.full_name} ("${activeSwimmer.nickname}")`
                    : activeSwimmer.full_name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mode === "setup"
                    ? "✨ First-Time PIN Setup"
                    : "🔒 Enter 4-Digit Security PIN"}
                </p>
              </div>
            </div>

            {/* Description Text */}
            <p className="text-xs text-muted-foreground leading-relaxed">
              {mode === "setup"
                ? "Choose a personal 4-digit PIN for your swimmer pass. Once created, only you will be able to unlock your attendance and RSVP dashboard."
                : "Enter your private 4-digit PIN to access your personal attendance records and upcoming squad practices."}
            </p>

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-coral/10 border border-coral/30 text-coral text-xs flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-medium leading-tight">{errorMessage}</span>
              </div>
            )}

            {/* PIN Entry Form */}
            <form onSubmit={handleSubmitPin} className="space-y-5">
              {/* Primary PIN Digits */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-foreground">
                    {mode === "setup" ? "Choose 4-Digit PIN" : "Security PIN"}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 font-semibold"
                  >
                    {showPin ? (
                      <>
                        <EyeOff className="w-3 h-3 text-aqua" />
                        <span>Hide digits</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3 text-aqua" />
                        <span>Show digits</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex justify-center gap-3">
                  {[0, 1, 2, 3].map((idx) => (
                    <input
                      key={`pin-${idx}`}
                      ref={(el) => {
                        pinInputRefs.current[idx] = el;
                      }}
                      type={showPin ? "text" : "password"}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      autoComplete="off"
                      value={pinDigits[idx]}
                      onChange={(e) => handleDigitChange(idx, e.target.value, false)}
                      onKeyDown={(e) => handleKeyDown(e, idx, false)}
                      className={cn(
                        "w-12 h-14 text-center text-2xl font-black rounded-2xl border bg-secondary/50 text-foreground transition-all focus:outline-none focus:ring-2 focus:ring-aqua focus:bg-background",
                        pinDigits[idx] ? "border-aqua bg-aqua/5" : "border-border"
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Confirm PIN Digits (Setup Mode Only) */}
              {mode === "setup" && (
                <div className="space-y-2 pt-1 animate-in fade-in">
                  <label className="text-xs font-bold text-foreground block">
                    Confirm 4-Digit PIN
                  </label>

                  <div className="flex justify-center gap-3">
                    {[0, 1, 2, 3].map((idx) => (
                      <input
                        key={`confirm-${idx}`}
                        ref={(el) => {
                          confirmInputRefs.current[idx] = el;
                        }}
                        type={showPin ? "text" : "password"}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        autoComplete="off"
                        value={confirmDigits[idx]}
                        onChange={(e) => handleDigitChange(idx, e.target.value, true)}
                        onKeyDown={(e) => handleKeyDown(e, idx, true)}
                        className={cn(
                          "w-12 h-14 text-center text-2xl font-black rounded-2xl border bg-secondary/50 text-foreground transition-all focus:outline-none focus:ring-2 focus:ring-seafoam focus:bg-background",
                          confirmDigits[idx] ? "border-seafoam bg-seafoam/5" : "border-border"
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-aqua to-seafoam text-ocean-950 font-black text-sm flex items-center justify-center gap-2 hover:opacity-95 shadow-md active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Verifying PIN...</span>
                  ) : mode === "setup" ? (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Create PIN & Unlock Pass</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Unlock Swimmer Pass</span>
                    </>
                  )}
                </button>

                {mode === "login" && (
                  <p className="text-[11px] text-center text-muted-foreground pt-1">
                    Forgot your PIN? Ask your coach to reset it from the squad roster.
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="text-center text-xs text-muted-foreground pb-6 border-t border-border/50 pt-4">
        SwimTrack &bull; The Aquatic Control Room for Squad Swimming
      </footer>
    </div>
  );
}

