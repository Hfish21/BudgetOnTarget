"use client";

import { Cloud } from "lucide-react";
import { useStorage } from "@/components/storage-provider";

/**
 * The mobile "Open from Google Drive" chooser. On small screens the Google
 * Picker is unreliable, so the storage provider lists the app's budget files
 * directly and asks the user to pick one here. Mounted once at the app root so
 * it works from both the first-run welcome screen and the loaded app.
 */
export function DriveChooser() {
  const { driveChooser, storageBusy, chooseDriveFile, cancelDriveChooser } =
    useStorage();

  if (!driveChooser) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm space-y-3 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Cloud className="size-4 text-emerald-400" />
          Open from Google Drive
        </h2>
        <p className="text-sm text-muted-foreground">
          Choose which budget to open.
        </p>
        <div className="max-h-72 space-y-1.5 overflow-y-auto">
          {driveChooser.map((f) => (
            <button
              key={f.fileId}
              onClick={() => void chooseDriveFile(f)}
              disabled={storageBusy}
              className="flex w-full items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-left transition-colors hover:bg-accent/50 disabled:opacity-50"
            >
              <Cloud className="size-4 shrink-0 text-emerald-400" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {f.name}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  Updated{" "}
                  {new Date(f.modifiedTime).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={cancelDriveChooser}
          disabled={storageBusy}
          className="w-full text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
