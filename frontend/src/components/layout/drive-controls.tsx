"use client";

import { CloudDownload, CloudUpload, Cloud, X } from "lucide-react";
import { useStorage } from "@/components/storage-provider";
import { isDriveConfigured } from "@/lib/drive/config";
import { cn } from "@/lib/utils";

/**
 * Google Drive open/save controls, shown in the sidebar footer. The whole block
 * is hidden if the app was built without Drive credentials, so a fork never
 * renders non-functional buttons.
 */
export function DriveControls() {
  const {
    driveRef,
    driveBusy,
    driveStatus,
    driveConflict,
    openFromDrive,
    saveToDrive,
    disconnectDrive,
    dismissConflict,
  } = useStorage();

  if (!isDriveConfigured()) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
        <Cloud className="size-3.5" />
        Google Drive
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => openFromDrive()}
          disabled={driveBusy}
          title="Open a .budget file from Google Drive"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground transition-colors disabled:opacity-50"
        >
          <CloudDownload className="size-4" />
          Open
        </button>
        <button
          onClick={() => saveToDrive()}
          disabled={driveBusy}
          title={
            driveRef
              ? `Save back to “${driveRef.name}” in Drive`
              : "Save a copy to Google Drive"
          }
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground transition-colors disabled:opacity-50"
        >
          <CloudUpload className="size-4" />
          {driveRef ? "Save" : "Save copy"}
        </button>
      </div>

      {driveRef && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          <span className="truncate" title={driveRef.name}>
            {driveRef.name}
          </span>
          <button
            onClick={disconnectDrive}
            title="Disconnect from Drive"
            className="ml-auto rounded p-0.5 hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {driveBusy && (
        <p className="text-[10px] text-muted-foreground/70">Working…</p>
      )}
      {!driveBusy && driveStatus && (
        <p
          className={cn(
            "text-[10px] leading-snug",
            driveStatus.startsWith("Couldn't")
              ? "text-amber-400"
              : "text-muted-foreground/70",
          )}
        >
          {driveStatus}
        </p>
      )}

      {driveConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl">
            <h2 className="text-base font-semibold">
              This file changed in Drive
            </h2>
            <p className="text-sm text-muted-foreground">
              “{driveConflict.name}” was updated on another device since you last
              loaded it. Saving now would overwrite that newer version.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => saveToDrive(true)}
                disabled={driveBusy}
                className="rounded-lg bg-amber-500/90 px-3 py-2 text-sm font-medium text-black hover:bg-amber-500 disabled:opacity-50"
              >
                Overwrite Drive with my version
              </button>
              <button
                onClick={() => dismissConflict()}
                disabled={driveBusy}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent/50 disabled:opacity-50"
              >
                Discard mine, load the Drive copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
