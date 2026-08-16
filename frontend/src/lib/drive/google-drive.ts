/**
 * Browser-only Google Drive client for BudgetOnTarget.
 *
 * Everything here runs in the user's browser and talks straight to Google —
 * no BudgetOnTarget server is ever in the path. We use:
 *   - Google Identity Services (GIS) for a short-lived OAuth access token
 *     (implicit token flow, no client secret, no refresh token).
 *   - The Google Picker as the "Open" dialog.
 *   - The Drive REST API to download / create / update the picked file.
 *
 * The token lives only in memory. It expires after ~1 hour; `getAccessToken`
 * silently re-requests it (and only shows Google's consent popup the first time
 * or if the user revoked access).
 */
import type { BudgetFile } from "../local-engine/types";
import {
  BUDGET_MIME_TYPE,
  DRIVE_SCOPE,
  GOOGLE_API_KEY,
  GOOGLE_APP_ID,
  GOOGLE_CLIENT_ID,
} from "./config";

/** A pointer to a budget file living in the user's Drive. */
export interface DriveFileRef {
  fileId: string;
  name: string;
  /** RFC-3339 timestamp of the last known Drive revision, for conflict checks. */
  modifiedTime: string;
}

/** Thrown by `saveToDrive` when the Drive copy changed since we last saw it. */
export class DriveConflictError extends Error {
  constructor(public remote: DriveFileRef) {
    super("The Google Drive copy changed on another device.");
    this.name = "DriveConflictError";
  }
}

/** Thrown when the user closes the consent popup or Picker without finishing. */
export class DriveCancelledError extends Error {
  constructor() {
    super("Google Drive action cancelled.");
    this.name = "DriveCancelledError";
  }
}

// --- Minimal typings for the Google globals we touch -------------------------

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}
interface TokenClient {
  requestAccessToken: (opts?: { prompt?: string }) => void;
  callback: (resp: TokenResponse) => void;
}
interface GoogleGlobal {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (resp: TokenResponse) => void;
      }) => TokenClient;
    };
  };
  picker: unknown;
}
interface GapiGlobal {
  load: (module: string, cb: () => void) => void;
}

function getGoogle(): GoogleGlobal {
  return (window as unknown as { google: GoogleGlobal }).google;
}
function getGapi(): GapiGlobal {
  return (window as unknown as { gapi: GapiGlobal }).gapi;
}

// --- Script loading ----------------------------------------------------------

const GIS_SRC = "https://accounts.google.com/gsi/client";
const GAPI_SRC = "https://apis.google.com/js/api.js";

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error(`Failed to load ${src}`)),
      );
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

let pickerLoaded = false;
async function ensurePickerLoaded(): Promise<void> {
  await loadScript(GAPI_SRC);
  if (pickerLoaded) return;
  await new Promise<void>((resolve) => {
    getGapi().load("picker", () => {
      pickerLoaded = true;
      resolve();
    });
  });
}

// --- Auth (GIS token client) -------------------------------------------------

let tokenClient: TokenClient | null = null;
let accessToken: string | null = null;
let tokenExpiry = 0; // epoch ms

async function ensureTokenClient(): Promise<TokenClient> {
  if (tokenClient) return tokenClient;
  await loadScript(GIS_SRC);
  tokenClient = getGoogle().accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: DRIVE_SCOPE,
    callback: () => {}, // set per-request in getAccessToken
  });
  return tokenClient;
}

/**
 * Return a valid access token, requesting one if we have none or it is about to
 * expire. `interactive` controls whether Google may show its popup: we allow it
 * for user-initiated actions (Open/Save) and suppress it for silent refreshes.
 */
export async function getAccessToken(interactive = true): Promise<string> {
  const now = Date.now();
  if (accessToken && now < tokenExpiry - 60_000) return accessToken;

  const client = await ensureTokenClient();
  return new Promise<string>((resolve, reject) => {
    client.callback = (resp: TokenResponse) => {
      if (resp.error || !resp.access_token) {
        reject(new DriveCancelledError());
        return;
      }
      accessToken = resp.access_token;
      tokenExpiry = Date.now() + (resp.expires_in ?? 3600) * 1000;
      resolve(accessToken);
    };
    // prompt "" lets Google reuse an existing grant silently when possible.
    client.requestAccessToken({ prompt: interactive ? "" : "none" });
  });
}

/** Forget the in-memory token (used when the user disconnects Drive). */
export function clearAccessToken(): void {
  accessToken = null;
  tokenExpiry = 0;
}

/**
 * Return the current in-memory access token only if it is still valid — never
 * requests a new one. Used by background checks that must stay silent: GIS's
 * token popup is blocked without a user gesture, so a background refresh can
 * only proceed when a token is already warm (i.e. shortly after the user did a
 * Drive open/save). Returns null otherwise, and the caller skips quietly.
 */
export function getCachedToken(): string | null {
  if (accessToken && Date.now() < tokenExpiry - 60_000) return accessToken;
  return null;
}

// --- Picker ------------------------------------------------------------------

interface PickerDocument {
  id: string;
  name: string;
}
interface PickerResult {
  action: string;
  docs?: PickerDocument[];
}

/**
 * Show the Google Picker and resolve with the chosen file's id + name, or
 * reject with DriveCancelledError if the user closes it. Only files the user
 * picks here become accessible to the app (drive.file scope).
 */
export async function pickBudgetFile(token: string): Promise<{
  fileId: string;
  name: string;
}> {
  await ensurePickerLoaded();
  const picker = (
    window as unknown as {
      google: { picker: Record<string, new (...args: unknown[]) => unknown> };
    }
  ).google.picker;

  return new Promise((resolve, reject) => {
    // Build a view of the user's own Drive files. We keep it unfiltered so
    // files created outside the app (e.g. a .budget uploaded by hand) still
    // show up; the content is validated after download.
    const PickerBuilder = picker.PickerBuilder as unknown as new () => {
      addView: (v: unknown) => unknown;
      setOAuthToken: (t: string) => { [k: string]: (...a: unknown[]) => unknown };
      setDeveloperKey: (k: string) => unknown;
      setAppId: (id: string) => unknown;
      setTitle: (t: string) => unknown;
      setCallback: (cb: (r: PickerResult) => void) => unknown;
      build: () => { setVisible: (v: boolean) => void };
    };
    const ViewId = (picker.ViewId as unknown as { DOCS: unknown }).DOCS;
    const DocsView = picker.DocsView as unknown as new (v: unknown) => {
      setOwnedByMe: (b: boolean) => unknown;
      setMode: (m: unknown) => unknown;
    };
    const Action = picker.Action as unknown as { PICKED: string; CANCEL: string };
    const Response = picker.Response as unknown as { ACTION: string };

    const view = new DocsView(ViewId);

    const builder = new PickerBuilder();
    // Chained builder calls return the builder; we cast loosely because the
    // Picker's fluent API is not typed here.
    const b = builder as unknown as {
      addView: (v: unknown) => typeof b;
      setOAuthToken: (t: string) => typeof b;
      setDeveloperKey: (k: string) => typeof b;
      setAppId: (id: string) => typeof b;
      setTitle: (t: string) => typeof b;
      setCallback: (cb: (r: PickerResult) => void) => typeof b;
      build: () => { setVisible: (v: boolean) => void };
    };

    b.addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_API_KEY)
      .setAppId(GOOGLE_APP_ID)
      .setTitle("Open a .budget file")
      .setCallback((result: PickerResult) => {
        const action = result[Response.ACTION as keyof PickerResult] as
          | string
          | undefined;
        const resolvedAction = action ?? result.action;
        if (resolvedAction === Action.PICKED) {
          const doc = result.docs?.[0];
          if (doc) {
            resolve({ fileId: doc.id, name: doc.name });
            return;
          }
        }
        if (resolvedAction === Action.CANCEL) {
          reject(new DriveCancelledError());
        }
      });

    b.build().setVisible(true);
  });
}

// --- Drive REST --------------------------------------------------------------

const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const META_FIELDS = "id,name,modifiedTime";

/** Fetch just the id/name/modifiedTime of a Drive file (for conflict checks). */
export async function driveMeta(
  token: string,
  fileId: string,
): Promise<DriveFileRef> {
  const res = await fetch(
    `${DRIVE_FILES}/${fileId}?fields=${encodeURIComponent(META_FIELDS)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Drive metadata failed: ${res.status}`);
  return toMeta(await res.json());
}

/** Download a Drive file's JSON content and parse it as a BudgetFile. */
export async function downloadBudget(
  token: string,
  fileId: string,
): Promise<BudgetFile> {
  const res = await fetch(`${DRIVE_FILES}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);
  const text = await res.text();
  return JSON.parse(text) as BudgetFile;
}

function toMeta(json: { id: string; name: string; modifiedTime: string }): DriveFileRef {
  return { fileId: json.id, name: json.name, modifiedTime: json.modifiedTime };
}

/** Create a brand-new .budget file in the user's Drive (root folder). */
export async function createBudget(
  token: string,
  name: string,
  data: BudgetFile,
): Promise<DriveFileRef> {
  const boundary = "budgetontarget-multipart-boundary-9d2f1a";
  const metadata = { name, mimeType: BUDGET_MIME_TYPE };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${BUDGET_MIME_TYPE}\r\n\r\n` +
    `${JSON.stringify(data, null, 2)}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    `${DRIVE_UPLOAD}?uploadType=multipart&fields=${encodeURIComponent(META_FIELDS)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) throw new Error(`Drive create failed: ${res.status}`);
  return toMeta(await res.json());
}

/**
 * Overwrite an existing Drive file's content. If `expected` is supplied and the
 * Drive copy's modifiedTime no longer matches, throws DriveConflictError
 * instead of clobbering a newer version (unless `force`).
 */
export async function updateBudget(
  token: string,
  ref: DriveFileRef,
  data: BudgetFile,
  opts: { force?: boolean } = {},
): Promise<DriveFileRef> {
  if (!opts.force) {
    const current = await driveMeta(token, ref.fileId);
    if (current.modifiedTime !== ref.modifiedTime) {
      throw new DriveConflictError(current);
    }
  }
  const res = await fetch(
    `${DRIVE_UPLOAD}/${ref.fileId}?uploadType=media&fields=${encodeURIComponent(META_FIELDS)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": BUDGET_MIME_TYPE,
      },
      body: JSON.stringify(data, null, 2),
    },
  );
  if (!res.ok) throw new Error(`Drive update failed: ${res.status}`);
  return toMeta(await res.json());
}

// --- High-level flows the storage provider calls ----------------------------

/**
 * Full "Open from Google Drive" flow: auth → pick → download.
 * Returns the parsed budget and a ref to save back to later.
 */
export async function openFromDrive(): Promise<{
  data: BudgetFile;
  ref: DriveFileRef;
}> {
  const token = await getAccessToken(true);
  const picked = await pickBudgetFile(token);
  const data = await downloadBudget(token, picked.fileId);
  const meta = await driveMeta(token, picked.fileId);
  return { data, ref: meta };
}

/**
 * Save the budget to Drive. With an existing `ref`, overwrites that file
 * (with a conflict guard); without one, creates a new file named `name`.
 */
export async function saveToDrive(
  data: BudgetFile,
  ref: DriveFileRef | null,
  name: string,
  opts: { force?: boolean } = {},
): Promise<DriveFileRef> {
  const token = await getAccessToken(true);
  if (ref) return updateBudget(token, ref, data, opts);
  return createBudget(token, name, data);
}
