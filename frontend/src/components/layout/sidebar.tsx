"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Upload,
  Target,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MonthSelector } from "@/components/dashboard/month-selector";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/targets", label: "Targets", icon: Target },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-border bg-card text-card-foreground">
      <div className="flex h-14 items-center px-5">
        <h1 className="text-lg font-semibold tracking-tight">LedgerLine</h1>
      </div>

      <div className="px-3 pb-4">
        <MonthSelector />
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4">
        <p className="text-xs text-muted-foreground">LedgerLine v0.1.0</p>
      </div>
    </aside>
  );
}
