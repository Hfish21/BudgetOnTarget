"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  ArrowLeftRight,
  Upload,
  Target,
  Settings,
  Eye,
  EyeOff,
  FolderOpen,
  Save,
  FilePlus2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MonthSelector } from "@/components/dashboard/month-selector";
import { usePrivacy } from "@/components/privacy-provider";
import { useStorage } from "@/components/storage-provider";

const navItems = [
  { href: "/dashboard", label: "Monthly", icon: LayoutDashboard },
  { href: "/trends", label: "Trends", icon: TrendingUp },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/targets", label: "Targets", icon: Target },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { privacyMode, togglePrivacy } = usePrivacy();
  const { mode, dirty, fileLoaded, openFile, saveFile, newFile } = useStorage();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-border bg-card text-card-foreground">
      <div className="flex h-14 items-center gap-2.5 px-5">
        <img src="/logo.svg" alt="BudgetOnTarget" className="size-7" />
        <h1 className="text-lg font-semibold tracking-tight">BudgetOnTarget</h1>
      </div>

      {(pathname.startsWith("/dashboard") || pathname.startsWith("/transactions")) && (
        <div className="px-3 pb-4">
          <MonthSelector />
        </div>
      )}

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

      <div className="border-t border-border p-4 space-y-3">
        {mode === "local" && (
          <div className="flex items-center gap-1">
            <button
              onClick={newFile}
              title="New file"
              className="flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground transition-colors"
            >
              <FilePlus2 className="size-4" />
            </button>
            <button
              onClick={openFile}
              title="Open file"
              className="flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground transition-colors"
            >
              <FolderOpen className="size-4" />
            </button>
            <button
              onClick={saveFile}
              title={dirty ? "Save file (unsaved changes)" : "Save file"}
              className={cn(
                "flex items-center justify-center rounded-lg p-2 transition-colors",
                dirty
                  ? "text-amber-400 hover:bg-amber-500/15"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
              )}
            >
              <Save className="size-4" />
            </button>
            {fileLoaded && (
              <span className="ml-auto text-[10px] text-muted-foreground/60">
                {dirty ? "Unsaved" : "Saved"}
              </span>
            )}
          </div>
        )}
        <button
          onClick={togglePrivacy}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            privacyMode
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
          )}
        >
          {privacyMode ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {privacyMode ? "Privacy On" : "Privacy Off"}
        </button>
        <p className="text-xs text-muted-foreground">BudgetOnTarget v0.1.0</p>
      </div>
    </aside>
  );
}
