import * as React from "react";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { MobileHeader, MobileBottomNav } from "@/components/layout/mobile-nav";
import { CommandPalette } from "@/components/layout/command-palette";
import { DataStore } from "@/lib/data-store";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const swimmers = DataStore.getSwimmers({ status: "all" });
  const sessions = DataStore.getSessions({ status: "all" });

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background text-foreground bg-control-grid relative">
      {/* Command Palette Keyboard Shortcut Support */}
      <CommandPalette swimmers={swimmers} sessions={sessions} />

      {/* Desktop Sidebar */}
      <AdminSidebar />

      {/* Mobile Top Header */}
      <MobileHeader />

      {/* Primary Scrollable Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-8">
        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav />
    </div>
  );
}
