"use client";

import { useEffect, useState } from "react";
import { Copy, Download, Trash2, Check, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  clearLog,
  formatEntry,
  getLog,
  subscribe,
  type LogEntry,
  type LogLevel,
} from "@/lib/logger";

const LEVEL_VARIANT: Record<LogLevel, "secondary" | "outline" | "destructive"> = {
  info: "secondary",
  warn: "outline",
  error: "destructive",
};

const LEVEL_CLASS: Record<LogLevel, string> = {
  info: "",
  warn: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  error: "",
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function timeLabel(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function ActivityLog() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setEntries(getLog());
    return subscribe(setEntries);
  }, []);

  // Newest-first for display.
  const rows = entries.slice().reverse();

  async function handleCopy() {
    const text = entries.map(formatEntry).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (permissions / insecure context) — no-op.
    }
  }

  function handleDownload() {
    try {
      const text = entries.map(formatEntry).join("\n");
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `budgetontarget-activity-${stamp}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Download unavailable — no-op.
    }
  }

  function handleClear() {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Clear the activity log? This can't be undone.")
    ) {
      return;
    }
    clearLog();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Activity log</h3>
          <p className="text-xs text-muted-foreground">
            Recent app events — imports, saves, updates, and errors. Contains no
            financial data, so it&apos;s safe to attach to a bug report.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={entries.length === 0}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={entries.length === 0}
          >
            <Download className="size-3.5" />
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={entries.length === 0}
          >
            <Trash2 className="size-3.5" />
            Clear log
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
          <Activity className="size-6 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">No activity logged yet.</p>
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto rounded-xl border border-border">
          <ul className="divide-y divide-border font-mono text-xs">
            {rows.map((e) => (
              <li key={e.id} className="flex items-start gap-2 px-3 py-2">
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {timeLabel(e.ts)}
                </span>
                <Badge
                  variant={LEVEL_VARIANT[e.level]}
                  className={LEVEL_CLASS[e.level]}
                >
                  {e.level}
                </Badge>
                <span className="shrink-0 text-muted-foreground">{e.category}</span>
                <span className="min-w-0 break-words">{e.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
