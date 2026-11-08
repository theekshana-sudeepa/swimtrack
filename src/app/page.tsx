import * as React from "react";
import Link from "next/link";
import {
  Waves,
  Calendar,
  CheckCircle2,
  Mail,
  BarChart3,
  ShieldCheck,
  Zap,
  ArrowRight,
  Github,
  Lock,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { SwimTrackLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function PublicLandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative overflow-hidden bg-control-grid">
      {/* Aquatic Ambient Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-gradient-to-b from-aqua/10 via-seafoam/5 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border/80">
        <div className="container mx-auto max-w-6xl h-16 flex items-center justify-between">
          <Link href="/" className="hover:opacity-90 transition-opacity">
            <SwimTrackLogo size="md" />
          </Link>

          <nav className="flex items-center gap-3 sm:gap-4">
            <ThemeToggle />

            <a
              href="https://github.com/ThikkaBro/SwimTrack"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card/60 hover:bg-card text-foreground transition-all"
            >
              <Github className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">GitHub</span>
            </a>

            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-aqua hover:bg-aqua-hover text-ocean-900 transition-all shadow-sm active:scale-95"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Admin Portal</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section */}
        <section className="container mx-auto max-w-6xl pt-16 pb-20 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border border-aqua/30 bg-aqua/5 text-aqua mb-6 animate-pulse">
            <Sparkles className="w-3 h-3 text-seafoam" />
            <span>Open-Source Sports Attendance Engine</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground max-w-4xl mx-auto leading-[1.15]">
            The <span className="text-aqua">Aquatic Control Room</span> for
            Squad Swimming.
          </h1>

          <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            A handcrafted, single-administrator platform designed to record
            attendance, manage recurring pool schedules, dispatch friendly email
            reminders, and visualize participation streaks.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-aqua hover:bg-aqua-hover text-ocean-950 font-bold text-sm transition-all shadow-lg hover:shadow-aqua/20 active:scale-95"
            >
              <Zap className="w-4 h-4" />
              <span>Open Attendance Command Center</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <a
              href="#features"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-border bg-card/50 hover:bg-card text-foreground font-semibold text-sm transition-all"
            >
              <span>Explore Architecture</span>
            </a>
          </div>

          {/* Interactive Control Room Visual Mockup (Synthetic Demonstration Data) */}
          <div className="mt-14 p-2 sm:p-4 rounded-2xl border border-border bg-card/40 backdrop-blur-md shadow-2xl relative">
            <div className="rounded-xl border border-border/70 bg-ocean-900 text-slate-100 p-4 sm:p-6 overflow-hidden text-left">
              {/* Mockup Header */}
              <div className="flex flex-wrap items-center justify-between pb-4 border-b border-ocean-800 gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-coral/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                  <div className="w-3 h-3 rounded-full bg-seafoam/80" />
                  <span className="text-xs font-mono text-ocean-300 ml-2">
                    LIVE REGISTER // SATURDAY MORNING ENDURANCE SQUAD
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 text-xs bg-ocean-800/80 px-2.5 py-1 rounded-md text-seafoam border border-seafoam/20">
                  <span className="w-2 h-2 rounded-full bg-seafoam animate-ping" />
                  88.9% Attendance Rate
                </div>
              </div>

              {/* Mockup Body Preview */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { name: "Liam Perera", status: "present", note: "Leading lane 2", time: "06:30 AM", color: "bg-seafoam/20 text-seafoam border-seafoam/30" },
                  { name: "Kavindi Silva", status: "present", note: "1500m open water prep", time: "06:30 AM", color: "bg-seafoam/20 text-seafoam border-seafoam/30" },
                  { name: "Senuka Fernando", status: "present", note: "Backstroke drill clean", time: "06:32 AM", color: "bg-seafoam/20 text-seafoam border-seafoam/30" },
                  { name: "Dilshan Mendis", status: "late", note: "Arrived 10m late", time: "06:40 AM", color: "bg-amber-400/20 text-amber-300 border-amber-400/30" },
                  { name: "Amara Jayawardena", status: "present", note: "Sprint intervals", time: "06:30 AM", color: "bg-seafoam/20 text-seafoam border-seafoam/30" },
                  { name: "Ryan Wickremasinghe", status: "absent", note: "Shift schedule", time: "-", color: "bg-coral/20 text-coral border-coral/30" },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-ocean-800 bg-ocean-950/60 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-100">{item.name}</p>
                      <p className="text-xs text-ocean-300">{item.note}</p>
                    </div>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${item.color}`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section id="features" className="container mx-auto max-w-6xl py-16 border-t border-border/80">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Engineered for Speed, Reliability, and Simplicity
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Everything required to coordinate friendly squad swims without
              bloatware, memberships, or commercial baggage.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-border bg-card hover:border-aqua/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-aqua/10 text-aqua flex items-center justify-center mb-4">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-2">
                Fast Mobile Register
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Mark everyone&apos;s status on pool deck in under 10 seconds.
                Supports single-tap Present, Late, Absent, Excused, and bulk
                actions.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-card hover:border-seafoam/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-seafoam/10 text-seafoam flex items-center justify-center mb-4">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-2">
                Series & Recurrence
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Weekly and bi-weekly schedules generated cleanly with duplicate
                prevention, participant snapshots, and .ics calendar downloads.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-card hover:border-aqua/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-aqua/10 text-aqua flex items-center justify-center mb-4">
                <Mail className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-2">
                Automated & Manual Reminders
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Powered by Resend and React Email. Includes atomic claim keys,
                duplicate protection, consent filtering, and morning cron
                delivery.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-card hover:border-coral/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-coral/10 text-coral flex items-center justify-center mb-4">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-2">
                Mathematical Analytics
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Accurate attendance rates excluding excused absences, heatmap
                activity calendars, and individual swimmer streak counters.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-card hover:border-aqua/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-aqua/10 text-aqua flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-2">
                Single-Admin Security
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Friends do not need accounts. Only one allowlisted administrator
                can manage sessions or mark registers. RLS enforced on Postgres.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-card hover:border-seafoam/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-seafoam/10 text-seafoam flex items-center justify-center mb-4">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-2">
                Audit Trail & History
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Full private audit logging records who changed attendance,
                reasons, and timestamps. Finalize sessions without losing
                precision.
              </p>
            </div>
          </div>
        </section>

        {/* Open Source & Tech Stack Notice */}
        <section className="container mx-auto max-w-4xl py-12 px-6 rounded-3xl border border-border bg-card/60 mb-20 text-center">
          <h2 className="text-xl font-bold text-foreground">
            100% Free & Open Source Personal Project
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto">
            Zero payments, zero subscriptions, zero tracking scripts. Built with
            Next.js App Router, Tailwind CSS, Supabase PostgreSQL, and Resend on
            Vercel Hobby.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground font-mono">
            <span className="px-2.5 py-1 rounded-md bg-secondary">Next.js 15</span>
            <span className="px-2.5 py-1 rounded-md bg-secondary">React 19</span>
            <span className="px-2.5 py-1 rounded-md bg-secondary">TypeScript</span>
            <span className="px-2.5 py-1 rounded-md bg-secondary">PostgreSQL</span>
            <span className="px-2.5 py-1 rounded-md bg-secondary">Resend</span>
            <span className="px-2.5 py-1 rounded-md bg-secondary">Tailwind CSS</span>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/80 bg-background/90 py-8">
        <div className="container mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <SwimTrackLogo size="sm" showWordmark={false} />
            <span>SwimTrack &bull; The Aquatic Control Room &bull; PolyForm Noncommercial License</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-foreground transition-colors">
              Admin Login
            </Link>
            <a
              href="https://github.com/ThikkaBro/SwimTrack"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub Repository
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

