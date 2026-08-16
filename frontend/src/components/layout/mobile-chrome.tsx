"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  ArrowLeftRight,
  Target,
  Upload,
  Settings,
  Menu,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MonthSelector } from "@/components/dashboard/month-selector";
import { usePrivacy } from "@/components/privacy-provider";
import { StorageControls } from "@/components/layout/storage-controls";

/**
 * Mobile-only chrome: a fixed top bar (menu + brand + contextual month
 * selector), a fixed bottom tab bar for the primary destinations, and a
 * slide-out drawer holding the full navigation, storage controls, and the
 * privacy toggle. Rendered only below `md`; the desktop sidebar takes over at
 * `md` and up. See `app-shell.tsx` for how the two are swapped.
 */

const PRIMARY_NAV = [
  { href: "/app/dashboard", label: "Monthly", icon: LayoutDashboard },
  { href: "/app/transactions", label: "Txns", icon: ArrowLeftRight },
  { href: "/app/trends", label: "Trends", icon: TrendingUp },
  { href: "/app/targets", label: "Targets", icon: Target },
];

// Everything, in sidebar order, for the drawer.
const DRAWER_NAV = [
  { href: "/app/dashboard", label: "Monthly", icon: LayoutDashboard },
  { href: "/app/trends", label: "Trends", icon: TrendingUp },
  { href: "/app/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/app/import", label: "Import", icon: Upload },
  { href: "/app/targets", label: "Targets", icon: Target },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

// Destinations that live only in the drawer — used to light up "More".
const MORE_ROUTES = ["/app/import", "/app/settings"];

export function MobileChrome() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  const showMonth =
    pathname.startsWith("/app/dashboard") ||
    pathname.startsWith("/app/transactions");
  const moreActive = MORE_ROUTES.some((r) => pathname.startsWith(r));

  // Close the drawer whenever the route changes (e.g. tapping a drawer link).
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <div className="md:hidden">
      {/* ---- Top bar ---- */}
      <header
        className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-card/90 px-2 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <Menu className="size-5" />
        </button>
        <Link href="/app/dashboard" className="flex min-w-0 items-center gap-2">
          <img src="/logo.svg" alt="" className="size-6 shrink-0" />
          <span className="truncate text-base font-semibold tracking-tight">
            BudgetOnTarget
          </span>
        </Link>
        {showMonth && (
          <div className="ml-auto min-w-0 max-w-[44%] shrink">
            <MonthSelector />
          </div>
        )}
      </header>

      {/* ---- Bottom tab bar ---- */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-border bg-card/90 backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {PRIMARY_NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <item.icon
                className={cn("size-5", active && "text-primary")}
                strokeWidth={active ? 2.4 : 2}
              />
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={() => setDrawerOpen(true)}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
            moreActive ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <Menu
            className={cn("size-5", moreActive && "text-primary")}
            strokeWidth={moreActive ? 2.4 : 2}
          />
          More
        </button>
      </nav>

      {/* ---- Drawer ---- */}
      {drawerOpen && (
        <MobileDrawer
          pathname={pathname}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}

function MobileDrawer({
  pathname,
  onClose,
}: {
  pathname: string;
  onClose: () => void;
}) {
  const { privacyMode, togglePrivacy } = usePrivacy();

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/50 duration-150 animate-in fade-in-0"
        onClick={onClose}
      />
      <div
        className="absolute inset-y-0 left-0 flex w-[84%] max-w-xs flex-col border-r border-border bg-card shadow-xl duration-200 animate-in slide-in-from-left"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="flex h-14 items-center gap-2 px-4">
          <img src="/logo.svg" alt="" className="size-6" />
          <span className="text-base font-semibold tracking-tight">
            BudgetOnTarget
          </span>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="ml-auto flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
          {DRAWER_NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
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

        <div className="space-y-3 border-t border-border p-4">
          <StorageControls />
          <button
            onClick={togglePrivacy}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              privacyMode
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
            )}
          >
            {privacyMode ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
            {privacyMode ? "Privacy On" : "Privacy Off"}
          </button>
          <p className="text-xs text-muted-foreground">BudgetOnTarget v0.1.0</p>
        </div>
      </div>
    </div>
  );
}
