"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Waves, Clock, Search } from "lucide-react";
import { ADMIN_NAV_ITEMS } from "./admin-nav-items";
import { SwimTrackLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/actions/auth-actions";
import { cn } from "@/lib/utils";

export function AdminSidebar() {
  const pathname = usePathname();
  const [colomboTime, setColomboTime] = React.useState<string>("");

  React.useEffect(() => {
    function updateClock() {
      const timeStr = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Colombo",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(new Date());
      setColomboTime(timeStr);
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="hidden lg:flex w-64 flex-col border-r border-border/80 bg-card/60 backdrop-blur-md shrink-0 h-screen sticky top-0 z-30 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-border/70 flex items-center justify-between">
        <Link href="/dashboard" className="hover:opacity-90 transition-opacity">
          <SwimTrackLogo size="md" />
        </Link>
      </div>

      {/* Sri Lanka Live Clock indicator */}
      <div className="px-5 py-2.5 bg-secondary/40 border-b border-border/60 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
        <span className="flex items-center gap-1.5 text-aqua font-semibold">
          <Clock className="w-3.5 h-3.5" />
          <span>Colombo</span>
        </span>
        <span>{colomboTime || "--:--:--"}</span>
      </div>

      {/* Quick Search Shortcut Pill */}
      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
            );
          }}
          className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground bg-secondary/60 hover:bg-secondary border border-border/70 rounded-xl transition-colors text-left"
        >
          <span className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-aqua" />
            <span>Quick search...</span>
          </span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-background border border-border rounded text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto">
        {ADMIN_NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative",
                isActive
                  ? "bg-ocean-900 text-aqua dark:bg-ocean-900/90 dark:text-aqua shadow-sm border border-aqua/30"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    "w-4 h-4 transition-colors",
                    isActive
                      ? "text-aqua"
                      : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                <span>{item.title}</span>
              </div>

              {item.badge && (
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-aqua/20 text-aqua border border-aqua/30">
                  {item.badge}
                </span>
              )}

              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r bg-aqua" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Administrator Area */}
      <div className="p-4 border-t border-border/80 space-y-3 bg-secondary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-ocean-900 border border-aqua/30 flex items-center justify-center text-aqua font-bold text-xs">
              AD
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-foreground leading-tight">
                Squad Admin
              </span>
              <span className="text-[10px] text-muted-foreground">
                Control Room
              </span>
            </div>
          </div>
          <ThemeToggle />
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-border/80 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 text-muted-foreground text-xs font-semibold transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}

