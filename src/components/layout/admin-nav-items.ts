import {
  LayoutDashboard,
  Users,
  Calendar,
  ClipboardCheck,
  Mail,
  BarChart3,
  CalendarDays,
  Settings,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  description?: string;
}

export const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Squad overview & next session",
  },
  {
    title: "Attendance",
    href: "/attendance",
    icon: ClipboardCheck,
    badge: "Live",
    description: "Attendance command center",
  },
  {
    title: "Swimmers",
    href: "/swimmers",
    icon: Users,
    description: "Roster & individual profiles",
  },
  {
    title: "Sessions",
    href: "/sessions",
    icon: Calendar,
    description: "Schedules & series",
  },
  {
    title: "Calendar",
    href: "/calendar",
    icon: CalendarDays,
    description: "Monthly & weekly agenda",
  },
  {
    title: "Reminders",
    href: "/reminders",
    icon: Mail,
    description: "Email notifications & cron logs",
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    description: "Streaks, rates & heatmaps",
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Club & system configuration",
  },
];

