"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardCheck,
  Users,
  Calendar,
  Menu,
  X,
  CalendarDays,
  Mail,
  BarChart3,
  Settings,
  LogOut,
  Search,
  Camera,
  Wallet,
} from "lucide-react";
import { SwimTrackLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/actions/auth-actions";
import { cn } from "@/lib/utils";

export function MobileHeader() {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const pathname = usePathname();

  // Close drawer on route change
  React.useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <>
      <header className="lg:hidden sticky top-0 z-40 h-14 bg-background/90 backdrop-blur-md border-b border-border/80 px-4 flex items-center justify-between">
        <Link href="/dashboard">
          <SwimTrackLogo size="sm" />
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(
                new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
              );
            }}
            aria-label="Open search command palette"
            className="p-2 rounded-xl border border-border bg-secondary/60 text-muted-foreground hover:text-foreground"
          >
            <Search className="w-4 h-4 text-aqua" />
          </button>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setDrawerOpen(!drawerOpen)}
            aria-label="Toggle navigation drawer"
            className="p-2 rounded-xl border border-border bg-secondary/60 text-foreground"
          >
            {drawerOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="fixed inset-y-0 right-0 w-3/4 max-w-xs bg-card border-l border-border p-6 shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <span className="font-bold text-sm text-foreground">Menu</span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="mt-4 space-y-1">
                {[
                  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
                  { title: "Attendance", href: "/attendance", icon: ClipboardCheck },
                  { title: "Swimmers", href: "/swimmers", icon: Users },
                  { title: "Sessions", href: "/sessions", icon: Calendar },
                  { title: "Calendar", href: "/calendar", icon: CalendarDays },
                  { title: "Memories", href: "/memories", icon: Camera },
                  { title: "Bill Splits", href: "/splits", icon: Wallet },
                  { title: "Reminders", href: "/reminders", icon: Mail },
                  { title: "Analytics", href: "/analytics", icon: BarChart3 },
                  { title: "Settings", href: "/settings", icon: Settings },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                        isActive
                          ? "bg-ocean-900 text-aqua border border-aqua/30"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-border">
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-destructive/10 text-destructive text-xs font-semibold"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();

  const primaryItems = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { title: "Swimmers", href: "/swimmers", icon: Users },
    {
      title: "Attendance",
      href: "/attendance",
      icon: ClipboardCheck,
      isSpecial: true,
    },
    { title: "Sessions", href: "/sessions", icon: Calendar },
    { title: "Calendar", href: "/calendar", icon: CalendarDays },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border/80 px-2 py-1.5 flex items-center justify-around">
      {primaryItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
        const Icon = item.icon;

        if (item.isSpecial) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center -mt-5"
            >
              <div className="w-12 h-12 rounded-2xl bg-aqua text-ocean-950 flex items-center justify-center shadow-lg shadow-aqua/30 border-2 border-background active:scale-95 transition-transform">
                <Icon className="w-6 h-6 stroke-[2.5]" />
              </div>
              <span className="text-[10px] font-bold text-aqua mt-1">
                {item.title}
              </span>
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center py-1 px-2.5 rounded-xl min-w-[56px] transition-colors",
              isActive ? "text-aqua" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-0.5">{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}

