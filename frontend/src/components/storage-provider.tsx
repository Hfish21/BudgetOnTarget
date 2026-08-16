"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getStore } from "@/lib/local-engine";
import {
  autoSave,
  loadAutoSave,
  loadDriveRef,
  openBudgetFile,
  saveBudgetFile,
  saveDriveRef,
} from "@/lib/local-engine/file-io";
import {
  DriveCancelledError,
  DriveConflictError,
  clearAccessToken,
  downloadBudget,
  getAccessToken,
  openFromDrive as driveOpen,
  saveToDrive as driveSave,
  type DriveFileRef,
} from "@/lib/drive/google-drive";

interface StorageContextValue {
  dirty: boolean;
  loading: boolean;
  fileLoaded: boolean;
  dataVersion: number;
  openFile: () => Promise<void>;
  saveFile: () => Promise<void>;
  newFile: () => void;
  completeSetup: () => void;
  // --- Google Drive ---
  driveRef: DriveFileRef | null;
  driveBusy: boolean;
  driveStatus: string | null;
  driveConflict: DriveFileRef | null;
  openFromDrive: () => Promise<void>;
  saveToDrive: (force?: boolean) => Promise<void>;
  disconnectDrive: () => void;
  dismissConflict: () => void;
}

const StorageContext = createContext<StorageContextValue | null>(null);

export function useStorage() {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error("useStorage must be used within StorageProvider");
  return ctx;
}

/** Default name for a budget saved to Drive for the first time. */
function defaultDriveName(): string {
  return `budget-${new Date().toISOString().slice(0, 10)}.budget`;
}

export function StorageProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fileLoaded, setFileLoaded] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [driveRef, setDriveRef] = useState<DriveFileRef | null>(null);
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveStatus, setDriveStatus] = useState<string | null>(null);
  const [driveConflict, setDriveConflict] = useState<DriveFileRef | null>(null);

  const store = getStore();

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setDirty(store.dirty);
      setDataVersion((n) => n + 1);

      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        autoSave(store.serialize()).catch(() => {});
      }, 2000);
    });
    return unsub;
  }, [store]);

  // Try loading from IndexedDB on mount (content + any Drive linkage)
  useEffect(() => {
    Promise.all([loadAutoSave(), loadDriveRef()])
      .then(([data, ref]) => {
        if (data && data.transactions?.length > 0) {
          store.load(data);
          store.markClean();
          setFileLoaded(true);
        }
        if (ref) setDriveRef(ref);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [store]);

  const openFile = useCallback(async () => {
    const data = await openBudgetFile();
    if (data) {
      store.load(data);
      store.markClean();
      setDirty(false);
      setFileLoaded(true);
    }
  }, [store]);

  const saveFile = useCallback(async () => {
    const data = store.serialize();
    await saveBudgetFile(data);
    store.markClean();
    setDirty(false);
  }, [store]);

  const newFile = useCallback(() => {
    store.clear();
    store.markClean();
    setDirty(false);
    setFileLoaded(true);
    // A fresh budget is no longer tied to the previously opened Drive file.
    setDriveRef(null);
    saveDriveRef(null).catch(() => {});
  }, [store]);

  const completeSetup = useCallback(() => {
    setFileLoaded(true);
    autoSave(store.serialize()).catch(() => {});
  }, [store]);

  // --- Google Drive flows ---------------------------------------------------

  const openFromDrive = useCallback(async () => {
    setDriveBusy(true);
    setDriveStatus(null);
    try {
      const { data, ref } = await driveOpen();
      store.load(data);
      store.markClean();
      setDirty(false);
      setFileLoaded(true);
      setDriveRef(ref);
      await saveDriveRef(ref);
      setDriveStatus(`Opened “${ref.name}” from Drive`);
    } catch (e) {
      if (e instanceof DriveCancelledError) {
        setDriveStatus(null);
      } else {
        setDriveStatus(
          `Couldn't open from Drive: ${(e as Error).message ?? "unknown error"}`,
        );
      }
    } finally {
      setDriveBusy(false);
    }
  }, [store]);

  const saveToDrive = useCallback(
    async (force = false) => {
      setDriveBusy(true);
      setDriveStatus(null);
      try {
        const data = store.serialize();
        const name = driveRef?.name ?? defaultDriveName();
        const ref = await driveSave(data, driveRef, name, { force });
        setDriveRef(ref);
        await saveDriveRef(ref);
        store.markClean();
        setDirty(false);
        setDriveConflict(null);
        setDriveStatus(`Saved to Drive · ${ref.name}`);
      } catch (e) {
        if (e instanceof DriveConflictError) {
          setDriveConflict(e.remote);
          setDriveStatus(null);
        } else if (e instanceof DriveCancelledError) {
          setDriveStatus(null);
        } else {
          setDriveStatus(
            `Couldn't save to Drive: ${(e as Error).message ?? "unknown error"}`,
          );
        }
      } finally {
        setDriveBusy(false);
      }
    },
    [store, driveRef],
  );

  const disconnectDrive = useCallback(() => {
    clearAccessToken();
    setDriveRef(null);
    setDriveConflict(null);
    setDriveStatus("Disconnected from Google Drive");
    saveDriveRef(null).catch(() => {});
  }, []);

  const dismissConflict = useCallback(async () => {
    // "Reload theirs": pull the current Drive copy, discarding local changes.
    if (!driveConflict) return;
    setDriveBusy(true);
    try {
      const token = await getAccessToken(true);
      const data = await downloadBudget(token, driveConflict.fileId);
      store.load(data);
      store.markClean();
      setDirty(false);
      setDriveRef(driveConflict);
      await saveDriveRef(driveConflict);
      setDriveStatus(`Reloaded the Drive copy of “${driveConflict.name}”`);
      setDriveConflict(null);
    } catch (e) {
      setDriveStatus(
        `Couldn't reload from Drive: ${(e as Error).message ?? "unknown error"}`,
      );
    } finally {
      setDriveBusy(false);
    }
  }, [store, driveConflict]);

  return (
    <StorageContext.Provider
      value={{
        dirty,
        loading,
        fileLoaded,
        dataVersion,
        openFile,
        saveFile,
        newFile,
        completeSetup,
        driveRef,
        driveBusy,
        driveStatus,
        driveConflict,
        openFromDrive,
        saveToDrive,
        disconnectDrive,
        dismissConflict,
      }}
    >
      {children}
    </StorageContext.Provider>
  );
}
