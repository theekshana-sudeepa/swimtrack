"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Lock, Mail, KeyRound, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import { SwimTrackLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { loginAction, demoLoginAction } from "@/actions/auth-actions";

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";

  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDemoSubmitting, setIsDemoSubmitting] = React.useState(false);

  async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const formData = new FormData(e.currentTarget);
    formData.set("redirectTo", redirectTo);

    try {
      const res = await loginAction(null, formData);
      if (res?.error) {
        setErrorMessage(res.error);
        setIsSubmitting(false);
      }
    } catch (err: unknown) {
      if (err && typeof err === "object" && "digest" in err) {
        throw err;
      }
      setErrorMessage("Authentication failed. Please check your credentials.");
      setIsSubmitting(false);
    }
  }

  async function handleDemoLogin() {
    setIsDemoSubmitting(true);
    setErrorMessage(null);
    try {
      await demoLoginAction(redirectTo);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "digest" in err) {
        throw err;
      }
      setIsDemoSubmitting(false);
    }
  }

  return (
    <div className="p-8 rounded-3xl border border-border bg-card/80 backdrop-blur-md shadow-2xl relative">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-ocean-900 border border-aqua/30 text-aqua flex items-center justify-center mx-auto mb-4 shadow-sm">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
          Administrator Access
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Enter your credentials to enter the Aquatic Control Room.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 p-3.5 rounded-xl border border-coral/30 bg-coral/10 text-coral flex items-start gap-2.5 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleFormSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-semibold text-foreground mb-1.5"
          >
            Administrator Email
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="email"
              name="email"
              type="email"
              required
              defaultValue="admin@example.com"
              placeholder="admin@example.com"
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-border bg-secondary/40 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-aqua transition-all"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-semibold text-foreground mb-1.5"
          >
            Master Password
          </label>
          <div className="relative">
            <KeyRound className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="password"
              name="password"
              type="password"
              required
              defaultValue="swimtrack2026"
              placeholder="••••••••••••"
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-border bg-secondary/40 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-aqua transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || isDemoSubmitting}
          className="w-full mt-2 py-3 px-4 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
        >
          {isSubmitting ? (
            <span>Authenticating...</span>
          ) : (
            <>
              <span>Sign In to Control Room</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Evaluation Quick Demo Access Button */}
      <div className="mt-6 pt-6 border-t border-border/80 text-center">
        <p className="text-xs text-muted-foreground mb-3">
          Evaluating this open-source repository?
        </p>
        <button
          type="button"
          onClick={handleDemoLogin}
          disabled={isSubmitting || isDemoSubmitting}
          className="w-full py-2.5 px-4 rounded-xl border border-seafoam/40 bg-seafoam/10 hover:bg-seafoam/20 text-seafoam font-semibold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
        >
          <ShieldCheck className="w-4 h-4 text-seafoam" />
          <span>
            {isDemoSubmitting ? "Entering..." : "Instant Demo Admin Sign In"}
          </span>
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-background text-foreground bg-control-grid relative overflow-hidden">
      {/* Ambient Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-aqua/15 via-seafoam/10 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Header Bar */}
      <div className="absolute top-6 left-6 right-6 max-w-5xl mx-auto flex items-center justify-between">
        <Link href="/" className="hover:opacity-90 transition-opacity">
          <SwimTrackLogo size="sm" />
        </Link>
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md mx-auto">
        <React.Suspense
          fallback={
            <div className="p-8 rounded-3xl border border-border bg-card/80 text-center text-xs text-muted-foreground">
              Loading administrator portal...
            </div>
          }
        >
          <LoginForm />
        </React.Suspense>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Single-administrator architecture. Swimmers do not require accounts.
        </p>
      </div>
    </div>
  );
}
