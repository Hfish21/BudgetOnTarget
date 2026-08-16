"use client";

import {
  FilePlus2,
  FolderOpen,
  Save,
  ChevronDown,
  Cloud,
  HardDrive,
  RefreshCw,
  X,
  AlertTriangle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStorage } from "@/components/storage-provider";
import { isDriveConfigured } from "@/lib/drive/config";
import { cn } from "@/lib/utils";

/**
 * Unified open/save controls for the sidebar footer. One Open button and one
 * Save button, each offering "This device" and "Google Drive" as destinations,
 * plus an always-visible indicator of where the canonical file lives — so the
 * source of truth is never ambiguous.
 */
export function StorageControls() {
  const {
    dirty,
    location,
    storageBusy,
    storageStatus,
    driveConflict,
    remoteUpdate,
    openFromLocal,
    openFromDrive,
    saveToLocal,
    saveToDrive,
    newFile,
    applyRemoteUpdate,
    dismissConflict,
    dismissRemoteUpdate,
  } = useStorage();

  const driveOn = isDriveConfigured();

  const triggerCls =
    "flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground transition-colors disabled:opacity-50 data-[popup-open]:bg-accent/50 data-[popup-open]:text-accent-foreground";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <button
          onClick={newFile}
          title="New budget"
          className="flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground transition-colors"
        >
          <FilePlus2 className="size-4" />
        </button>

        {/* Open ▾ */}
        <DropdownMenu>
          <DropdownMenuTrigger className={triggerCls} disabled={storageBusy}>
            <FolderOpen className="size-4" />
            Open
            <ChevronDown className="size-3 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Open a budget from…
            </div>
            <DropdownMenuItem onClick={() => void openFromLocal()}>
              <HardDrive className="mr-2 size-4" />
              This device
            </DropdownMenuItem>
            {driveOn && (
              <DropdownMenuItem onClick={() => void openFromDrive()}>
                <Cloud className="mr-2 size-4" />
                Google Drive
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Save ▾ */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(triggerCls, dirty && "text-amber-400")}
            disabled={storageBusy}
            title={dirty ? "Unsaved changes" : "Saved"}
          >
            <Save className="size-4" />
            Save
            <ChevronDown className="size-3 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Save this budget to…
            </div>
            <DropdownMenuItem onClick={() => void saveToLocal()}>
              <HardDrive className="mr-2 size-4" />
              This device
              {location.kind === "local" && (
                <span className="ml-auto text-[10px] text-muted-foreground">
                  current
                </span>
              )}
            </DropdownMenuItem>
            {driveOn && (
              <DropdownMenuItem onClick={() => void saveToDrive()}>
                <Cloud className="mr-2 size-4" />
                Google Drive
                {location.kind === "drive" && (
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    current
                  </span>
                )}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Canonical-location indicator */}
      <LocationIndicator />

      {/* Status / busy line */}
      {storageBusy ? (
        <p className="text-[10px] text-muted-foreground/70">Working…</p>
      ) : (
        storageStatus && (
          <p
            className={cn(
              "text-[10px] leading-snug",
              storageStatus.startsWith("Couldn't")
                ? "text-amber-400"
                : "text-muted-foreground/70",
            )}
          >
            {storageStatus}
          </p>
        )
      )}

      {/* Another device pushed a newer version (we had unsaved edits) */}
      {remoteUpdate && (
        <div className="space-y-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-amber-300">
            <RefreshCw className="size-3.5" />
            Updated on another device
          </p>
          <p className="text-[10px] leading-snug text-muted-foreground">
            “{remoteUpdate.name}” changed elsewhere and you have unsaved edits.
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => void applyRemoteUpdate()}
              disabled={storageBusy}
              className="flex-1 rounded-md bg-amber-500/90 px-2 py-1 text-[10px] font-medium text-black hover:bg-amber-500 disabled:opacity-50"
            >
              Refresh
            </button>
            <button
              onClick={dismissRemoteUpdate}
              disabled={storageBusy}
              className="flex-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium hover:bg-accent/50 disabled:opacity-50"
            >
              Keep mine
            </button>
          </div>
        </div>
      )}

      {/* Save-time conflict: our save was blocked by a newer Drive copy */}
      {driveConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <AlertTriangle className="size-4 text-amber-400" />
              This file changed in Drive
            </h2>
            <p className="text-sm text-muted-foreground">
              “{driveConflict.name}” was updated on another device since you last
              loaded it. Saving now would overwrite that newer version.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => void saveToDrive(true)}
                disabled={storageBusy}
                className="rounded-lg bg-amber-500/90 px-3 py-2 text-sm font-medium text-black hover:bg-amber-500 disabled:opacity-50"
              >
                Overwrite Drive with my version
              </button>
              <button
                onClick={() => void applyRemoteUpdate()}
                disabled={storageBusy}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent/50 disabled:opacity-50"
              >
                Discard mine, load the Drive copy
              </button>
              <button
                onClick={dismissConflict}
                disabled={storageBusy}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LocationIndicator() {
  const { location, dirty, forgetLocation } = useStorage();

  if (location.kind === "none") {
    return (
      <p className="text-[10px] leading-snug text-muted-foreground/60">
        Not saved to a file yet — use <span className="font-medium">Save</span>{" "}
        to choose Drive or this device.
      </p>
    );
  }

  const isDrive = location.kind === "drive";
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80">
      {isDrive ? (
        <Cloud className="size-3.5 shrink-0 text-emerald-400" />
      ) : (
        <HardDrive className="size-3.5 shrink-0 text-sky-400" />
      )}
      <span className="truncate" title={location.name}>
        {location.name}
      </span>
      <span className="shrink-0 text-muted-foreground/50">
        · {isDrive ? "Drive" : "This device"}
      </span>
      {dirty && <span className="shrink-0 text-amber-400">• Unsaved</span>}
      <button
        onClick={forgetLocation}
        title="Unlink from this file"
        className="ml-auto shrink-0 rounded p-0.5 hover:text-foreground"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
