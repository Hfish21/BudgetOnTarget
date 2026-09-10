"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logEvent } from "@/lib/logger";

/**
 * Clears the app's CODE cache (service workers + Cache Storage) and reloads to
 * pull the latest deployed build. Deliberately touches NOTHING that holds data
 * — IndexedDB, localStorage, the open file, and Drive refs all survive.
 */
export function UpdateApp() {
  const [updating, setUpdating] = useState(false);

  async function handleUpdate() {
    setUpdating(true);
    logEvent("app", "Manual update requested (clearing code cache)");

    // Unregister every service worker so a stale one can't re-serve old code.
    try {
      if (
        typeof navigator !== "undefined" &&
        "serviceWorker" in navigator &&
        navigator.serviceWorker
      ) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
      }
    } catch {
      // Unsupported or blocked — proceed to the reload regardless.
    }

    // Delete all Cache Storage entries (the cached HTML/JS/CSS). Never IndexedDB.
    try {
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
      }
    } catch {
      // Cache API unavailable — nothing to clear.
    }

    try {
      window.location.reload();
    } catch {
      setUpdating(false);
    }
  }

  return (
    <div className="rounded-xl border border-border p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <RefreshCw className="size-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Update to latest version</h3>
          <p className="text-sm text-muted-foreground">
            Reloads the app and re-downloads the latest version. Your budget
            data is not affected.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleUpdate}
          disabled={updating}
        >
          <RefreshCw className={updating ? "size-3.5 animate-spin" : "size-3.5"} />
          {updating ? "Updating…" : "Update now"}
        </Button>
      </div>
    </div>
  );
}
