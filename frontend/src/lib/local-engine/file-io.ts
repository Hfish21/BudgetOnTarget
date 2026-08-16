import type { BudgetFile } from "./types";
import type { DriveFileRef } from "../drive/google-drive";

export async function saveBudgetFile(data: BudgetFile): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });

  if ("showSaveFilePicker" in window) {
    try {
      const handle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
        suggestedName: `budget-${new Date().toISOString().slice(0, 10)}.budget`,
        types: [
          {
            description: "Budget File",
            accept: { "application/json": [".budget"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      // Fall through to download
    }
  }

  // Fallback: download link
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `budget-${new Date().toISOString().slice(0, 10)}.budget`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function openBudgetFile(): Promise<BudgetFile | null> {
  if ("showOpenFilePicker" in window) {
    try {
      const [handle] = await (window as unknown as { showOpenFilePicker: (opts: unknown) => Promise<FileSystemFileHandle[]> }).showOpenFilePicker({
        types: [
          {
            description: "Budget File",
            accept: { "application/json": [".budget", ".json"] },
          },
        ],
        multiple: false,
      });
      const file = await handle.getFile();
      const text = await file.text();
      return JSON.parse(text) as BudgetFile;
    } catch (e) {
      if ((e as Error).name === "AbortError") return null;
      throw e;
    }
  }

  // Fallback: file input
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
      const text = await file.text();
      resolve(JSON.parse(text) as BudgetFile);
    };
    input.click();
  });
}

const IDB_NAME = "budgetontarget";
const IDB_STORE = "autosave";
const IDB_KEY = "current";
const IDB_DRIVE_KEY = "driveRef";

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

export async function autoSave(data: BudgetFile): Promise<void> {
  const db = await openIDB();
  const tx = db.transaction(IDB_STORE, "readwrite");
  tx.objectStore(IDB_STORE).put(data, IDB_KEY);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadAutoSave(): Promise<BudgetFile | null> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
    const result = await new Promise<BudgetFile | null>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}

/**
 * Persist the pointer to a Drive-backed file (or clear it with `null`), so a
 * reload knows the current budget lives in Google Drive. The access token is
 * never stored — only this small, non-sensitive reference.
 */
export async function saveDriveRef(ref: DriveFileRef | null): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    if (ref) store.put(ref, IDB_DRIVE_KEY);
    else store.delete(IDB_DRIVE_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // best-effort; a lost ref just means the user re-picks the file
  }
}

export async function loadDriveRef(): Promise<DriveFileRef | null> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(IDB_DRIVE_KEY);
    const result = await new Promise<DriveFileRef | null>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as DriveFileRef) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}
