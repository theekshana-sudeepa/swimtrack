"use client";

import * as React from "react";
import { Lock, KeyRound, RefreshCw, CheckCircle2, ShieldAlert, X, Mail } from "lucide-react";
import { adminResetSwimmerPinAction } from "@/actions/portal-actions";
import { sendSwimmerPassSetupEmailAction } from "@/actions/reminder-actions";
import { toast } from "sonner";

interface SwimmerPinAdminControlProps {
  swimmerId: string;
  swimmerName: string;
  initialHasPin: boolean;
}

export function SwimmerPinAdminControl({
  swimmerId,
  swimmerName,
  initialHasPin,
}: SwimmerPinAdminControlProps) {
  const [hasPin, setHasPin] = React.useState(initialHasPin);
  const [showModal, setShowModal] = React.useState(false);
  const [newPin, setNewPin] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSendingEmail, setIsSendingEmail] = React.useState(false);

  async function handleSendSetupEmail() {
    setIsSendingEmail(true);
    try {
      const res = await sendSwimmerPassSetupEmailAction(swimmerId);
      if (res.success) {
        toast.success(`Pass setup guide email sent to ${swimmerName}!`);
      } else {
        toast.error(res.error || "Failed to send setup guide email.");
      }
    } catch {
      toast.error("Failed to send setup guide email.");
    } finally {
      setIsSendingEmail(false);
    }
  }

  async function handleClearPin() {
    if (!confirm(`Are you sure you want to reset the security PIN for ${swimmerName}? They will be prompted to create a new PIN when they log in.`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await adminResetSwimmerPinAction(swimmerId);
      if (res.success) {
        setHasPin(false);
        toast.success(res.message);
      } else {
        toast.error(res.error || "Failed to reset PIN.");
      }
    } catch {
      toast.error("Failed to reset PIN.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSetCustomPin(e: React.FormEvent) {
    e.preventDefault();
    const clean = newPin.trim();
    if (!/^\d{4}$/.test(clean)) {
      toast.error("PIN must be exactly 4 numeric digits.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await adminResetSwimmerPinAction(swimmerId, clean);
      if (res.success) {
        setHasPin(true);
        setShowModal(false);
        setNewPin("");
        toast.success(res.message);
      } else {
        toast.error(res.error || "Failed to set PIN.");
      }
    } catch {
      toast.error("Failed to set PIN.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-aqua/10 text-aqua border border-aqua/30 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground flex items-center gap-2">
              <span>Swimmer Pass Security PIN</span>
              {hasPin ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-seafoam/15 text-seafoam border border-seafoam/40">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  <span>Configured</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 border border-amber-400/40">
                  <ShieldAlert className="w-2.5 h-2.5" />
                  <span>Not Set</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {hasPin
                ? "4-digit security PIN is active. Swimmer can unlock their pass using this PIN."
                : "Swimmer will create their 4-digit PIN on their first pass login."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            disabled={isSendingEmail}
            onClick={handleSendSetupEmail}
            className="px-3 py-1.5 rounded-xl border border-aqua/30 bg-aqua/10 hover:bg-aqua/20 text-aqua text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5"
            title="Email setup instructions to this swimmer"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>{isSendingEmail ? "Sending..." : "Send Setup Email"}</span>
          </button>

          {hasPin && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleClearPin}
              className="px-3 py-1.5 rounded-xl border border-border bg-secondary/50 hover:bg-secondary text-xs font-semibold text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
            >
              Reset PIN
            </button>
          )}

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => setShowModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            title="Set custom 4-digit PIN"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>{hasPin ? "Change PIN" : "Set 4-Digit PIN"}</span>
          </button>
        </div>
      </div>

      {/* Admin Set PIN Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">
                Set PIN for {swimmerName}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Enter a new 4-digit numeric PIN for this swimmer.
            </p>

            <form onSubmit={handleSetCustomPin} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                required
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="4-digit PIN (e.g. 1234)"
                className="w-full text-center tracking-[0.5em] text-2xl font-black px-4 py-2.5 rounded-xl border border-border bg-secondary/50 text-foreground focus:outline-none focus:ring-2 focus:ring-aqua"
                autoFocus
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || newPin.length !== 4}
                  className="px-4 py-1.5 rounded-xl bg-aqua text-ocean-950 font-bold text-xs hover:bg-aqua-hover disabled:opacity-50"
                >
                  Save PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

