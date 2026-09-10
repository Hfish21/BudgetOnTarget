/**
 * Lightweight in-app activity log.
 *
 * A rolling, string-only buffer of recent events (imports, storage actions,
 * app updates, and uncaught errors) that the user can view under Settings →
 * Diagnostics and attach to a bug report.
 *
 * PRIVACY — READ THIS BEFORE ADDING A CALL SITE:
 * The log is attached to PUBLIC GitHub issues. NEVER log financial data —
 * no transaction amounts, descriptions, balances, or running totals — and
 * avoid personal identifiers (account/member names, .budget or CSV filenames).
 * Log counts, types, ids, enum values, and event names only.
 */

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  id: string;
  /** Epoch milliseconds. */
  ts: number;
  level: LogLevel;
  category: string;
  message: string;
}

const CAP = 200;
const STORAGE_KEY = "bot.activityLog";
const ERROR_MSG_MAX = 200;

let buffer: LogEntry[] = [];
let loaded = false;
const subscribers = new Set<(entries: LogEntry[]) => void>();
let handlersInstalled = false;
let counter = 0;

function makeId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(buffer));
  } catch {
    // Private mode / quota / SSR — logging is best-effort, never fatal.
  }
}

function loadFromStorage(): void {
  if (loaded) return;
  loaded = true;
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      buffer = parsed
        .filter(
          (e): e is LogEntry =>
            e &&
            typeof e.id === "string" &&
            typeof e.ts === "number" &&
            typeof e.message === "string"
        )
        .slice(-CAP);
    }
  } catch {
    buffer = [];
  }
}

function notify(): void {
  const snapshot = getLog();
  for (const fn of subscribers) {
    try {
      fn(snapshot);
    } catch {
      // A misbehaving subscriber must not break logging.
    }
  }
}

/** Append an event. `category` and `message` must be string-only, no PII. */
export function logEvent(
  category: string,
  message: string,
  level: LogLevel = "info"
): void {
  loadFromStorage();
  const entry: LogEntry = {
    id: makeId(),
    ts: Date.now(),
    level,
    category: String(category).slice(0, 40),
    message: String(message).slice(0, 500),
  };
  buffer.push(entry);
  if (buffer.length > CAP) buffer = buffer.slice(-CAP);
  persist();
  notify();
}

/** All entries, oldest-first (the buffer's natural order). */
export function getLog(): LogEntry[] {
  loadFromStorage();
  return buffer.slice();
}

/** Subscribe to log changes; returns an unsubscribe function. */
export function subscribe(fn: (entries: LogEntry[]) => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function clearLog(): void {
  buffer = [];
  persist();
  notify();
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** One entry as `HH:MM:SS [level] category: message`. */
export function formatEntry(e: LogEntry): string {
  return `${formatTime(e.ts)} [${e.level}] ${e.category}: ${e.message}`;
}

/**
 * Plain-text log, newest-last, trimmed to fit `maxChars` by dropping the
 * OLDEST lines first (so the most recent activity — usually what matters for a
 * bug — always survives).
 */
export function formatLogForReport(maxChars: number): string {
  loadFromStorage();
  if (buffer.length === 0) return "";
  const lines = buffer.map(formatEntry);
  let out = lines.join("\n");
  if (out.length <= maxChars) return out;

  // Keep as many newest lines as fit.
  const kept: string[] = [];
  let used = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    const cost = lines[i].length + (kept.length ? 1 : 0);
    if (used + cost > maxChars) break;
    kept.unshift(lines[i]);
    used += cost;
  }
  out = kept.join("\n");
  // Nothing fit (a single huge line) — hard-trim from the end.
  if (out.length === 0) out = lines[lines.length - 1].slice(-maxChars);
  return out;
}

/**
 * Install global error handlers ONCE. Client-only and idempotent. Messages are
 * truncated and never include a full stack, so no user data leaks into the log.
 */
export function initLogger(): void {
  loadFromStorage();
  if (handlersInstalled || typeof window === "undefined") return;
  handlersInstalled = true;

  window.addEventListener("error", (event) => {
    const msg =
      (event.error instanceof Error
        ? `${event.error.name}: ${event.error.message}`
        : event.message) || "Unknown error";
    logEvent("error", msg.slice(0, ERROR_MSG_MAX), "error");
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const msg =
      reason instanceof Error
        ? `${reason.name}: ${reason.message}`
        : typeof reason === "string"
          ? reason
          : "Unhandled promise rejection";
    logEvent("error", msg.slice(0, ERROR_MSG_MAX), "error");
  });
}
