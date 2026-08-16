import type { BudgetFile } from "./types";
import type { DriveFileRef } from "../drive/google-drive";

// ---------------------------------------------------------------------------
// Local file save / open
//
// On Chromium the File System Access API gives us a real, reusable handle to a
// file on disk, so "Save to this device" can write back to the same file
// silently — the same way "Save to Drive" writes back to the same Drive file.
// The handle is persisted in IndexedDB (handles are structured-cloneable) so
// the linkage survives a reload; permission is re-checked on reuse. Browsers
// without the API (Firefox/Safari) fall back to a download and get no reusable
// handle — there, each local save re-downloads a fresh file.
// ---------------------------------------------------------------------------

/** A handle plus the extra permission methods not in the standard DOM lib. */
export type WritableFileHandle = FileSystemFileHandle & {
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
  queryPermission?: (opts: { mode: string }) => Promise<PermissionState>;
  requestPermission?: (opts: { mode: string }) => Promise<PermissionState>;
};

interface FsWindow {
  showSaveFilePicker?: (opts: unknown) => Promise<WritableFileHandle>;
  showOpenFilePicker?: (opts: unknown) => Promise<WritableFileHandle[]>;
}

const FILE_TYPES = [
  { description: "Budget File", accept: { "application/json": [".budget"] } },
];
const OPEN_TYPES = [
  {
    description: "Budget File",
    accept: { "application/json": [".budget", ".json"] },
  },
];

function suggestedName(): string {
  return `budget-${new Date().toISOString().slice(0, 10)}.budget`;
}

function toBlob(data: BudgetFile): Blob {
  return new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
}

function supportsFsAccess(): boolean {
  return typeof window !== "undefined" && "showSaveFilePicker" in window;
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface LocalSaveResult {
  /** The reusable handle, or null when we fell back to a download. */
  handle: WritableFileHandle | null;
  name: string;
}

export interface LocalOpenResult {
  data: BudgetFile;
  handle: WritableFileHandle | null;
  name: string;
}

/**
 * Write to an existing local handle (silent write-back). Returns false if the
 * user declined the readwrite permission, true on success.
 */
export async function saveToLocalHandle(
  handle: WritableFileHandle,
  data: BudgetFile,
): Promise<boolean> {
  const opts = { mode: "readwrite" };
  const current = (await handle.queryPermission?.(opts)) ?? "granted";
  if (current !== "granted") {
    const requested = (await handle.requestPermission?.(opts)) ?? "denied";
    if (requested !== "granted") return false;
  }
  const writable = await handle.createWritable();
  await writable.write(toBlob(data));
  await writable.close();
  return true;
}

/**
 * Prompt for a new local location and save there. Returns the new handle+name
 * (handle null on the download fallback), or null if the user cancelled.
 */
export async function pickAndSaveLocal(
  data: BudgetFile,
  name?: string,
): Promise<LocalSaveResult | null> {
  const fname = name ?? suggestedName();
  const fsWindow = window as unknown as FsWindow;
  if (supportsFsAccess() && fsWindow.showSaveFilePicker) {
    try {
      const handle = await fsWindow.showSaveFilePicker({
        suggestedName: fname,
        types: FILE_TYPES,
      });
      const writable = await handle.createWritable();
      await writable.write(toBlob(data));
      await writable.close();
      return { handle, name: handle.name ?? fname };
    } catch (e) {
      if ((e as Error).name === "AbortError") return null;
      // fall through to download
    }
  }
  downloadBlob(toBlob(data), fname);
  return { handle: null, name: fname };
}

/** Open a local file, returning its data plus a reusable handle when possible. */
export async function openLocalFile(): Promise<LocalOpenResult | null> {
  const fsWindow = window as unknown as FsWindow;
  if ("showOpenFilePicker" in window && fsWindow.showOpenFilePicker) {
    try {
      const [handle] = await fsWindow.showOpenFilePicker({
        types: OPEN_TYPES,
        multiple: false,
      });
      const file = await handle.getFile();
      const data = JSON.parse(await file.text()) as BudgetFile;
      return { data, handle, name: handle.name ?? file.name };
    } catch (e) {
      if ((e as Error).name === "AbortError") return null;
      throw e;
    }
  }

  // Fallback: <input type=file>, no reusable handle.
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".budget,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const data = JSON.parse(await file.text()) as BudgetFile;
      resolve({ data, handle: null, name: file.name });
    };
    input.click();
  });
}

// ---------------------------------------------------------------------------
// IndexedDB: autosave snapshot + storage-location bookkeeping
// ---------------------------------------------------------------------------

const IDB_NAME = "budgetontarget";
const IDB_STORE = "autosave";
const IDB_KEY = "current";
const IDB_DRIVE_KEY = "driveRef";
const IDB_LOCAL_HANDLE_KEY = "localHandle";
const IDB_LOCATION_KEY = "location";

/** Which store the user's canonical file currently lives in. */
export type StorageLocation =
  | { kind: "none" }
  | { kind: "drive"; name: string }
  | { kind: "local"; name: string };

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(key: string, value: unknown): Promise<void> {
  return openIDB().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        if (value === null || value === undefined)
          tx.objectStore(IDB_STORE).delete(key);
        else tx.objectStore(IDB_STORE).put(value, key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

function idbGet<T>(key: string): Promise<T | null> {
  return openIDB().then(
    (db) =>
      new Promise<T | null>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readonly");
        const req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = () => {
          db.close();
          resolve((req.result as T) ?? null);
        };
        req.onerror = () => {
          db.close();
          reject(req.error);
        };
      }),
  );
}

export async function autoSave(data: BudgetFile): Promise<void> {
  await idbPut(IDB_KEY, data);
}

export async function loadAutoSave(): Promise<BudgetFile | null> {
  try {
    return await idbGet<BudgetFile>(IDB_KEY);
  } catch {
    return null;
  }
}

/**
 * Persist the pointer to a Drive-backed file (or clear it with `null`). The
 * access token is never stored — only this small, non-sensitive reference.
 */
export async function saveDriveRef(ref: DriveFileRef | null): Promise<void> {
  try {
    await idbPut(IDB_DRIVE_KEY, ref);
  } catch {
    // best-effort; a lost ref just means the user re-picks the file
  }
}

export async function loadDriveRef(): Promise<DriveFileRef | null> {
  try {
    return await idbGet<DriveFileRef>(IDB_DRIVE_KEY);
  } catch {
    return null;
  }
}

/** Persist / read the reusable local file handle (Chromium only). */
export async function saveLocalHandle(
  handle: WritableFileHandle | null,
): Promise<void> {
  try {
    await idbPut(IDB_LOCAL_HANDLE_KEY, handle);
  } catch {
    // handles are structured-cloneable, but be defensive
  }
}

export async function loadLocalHandle(): Promise<WritableFileHandle | null> {
  try {
    return await idbGet<WritableFileHandle>(IDB_LOCAL_HANDLE_KEY);
  } catch {
    return null;
  }
}

/** Persist / read which store is canonical, so a reload knows the source of truth. */
export async function saveLocation(location: StorageLocation): Promise<void> {
  try {
    await idbPut(IDB_LOCATION_KEY, location);
  } catch {
    // best-effort
  }
}

export async function loadLocation(): Promise<StorageLocation> {
  try {
    return (await idbGet<StorageLocation>(IDB_LOCATION_KEY)) ?? { kind: "none" };
  } catch {
    return { kind: "none" };
  }
}
