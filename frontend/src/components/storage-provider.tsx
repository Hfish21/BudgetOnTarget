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
  loadLocalHandle,
  loadLocation,
  openLocalFile,
  pickAndSaveLocal,
  saveDriveRef,
  saveLocalHandle,
  saveLocation,
  saveToLocalHandle,
  type StorageLocation,
  type WritableFileHandle,
} from "@/lib/local-engine/file-io";
import {
  DriveAuthError,
  DriveCancelledError,
  DriveConflictError,
  clearAccessToken,
  downloadBudget,
  driveMeta,
  getAccessToken,
  getCachedToken,
  listBudgetFiles,
  openFromDrive as driveOpen,
  preloadDriveScripts,
  saveToDrive as driveSave,
  type DriveFileRef,
} from "@/lib/drive/google-drive";
import { isDriveConfigured } from "@/lib/drive/config";

interface StorageContextValue {
  dirty: boolean;
  loading: boolean;
  fileLoaded: boolean;
  dataVersion: number;
  /** Where the canonical file currently lives. */
  location: StorageLocation;
  storageBusy: boolean;
  storageStatus: string | null;
  /** Set when a save is blocked because the Drive copy changed first. */
  driveConflict: DriveFileRef | null;
  /** Set when a background check finds a newer Drive copy on another device. */
  remoteUpdate: DriveFileRef | null;
  /** Set when the mobile Drive open flow needs the user to pick from a list. */
  driveChooser: DriveFileRef[] | null;

  // open / save
  openFromLocal: () => Promise<void>;
  openFromDrive: () => Promise<void>;
  /** Open a budget chosen from the mobile Drive chooser. */
  chooseDriveFile: (ref: DriveFileRef) => Promise<void>;
  /** Dismiss the mobile Drive chooser without opening anything. */
  cancelDriveChooser: () => void;
  saveToLocal: () => Promise<void>;
  saveToDrive: (force?: boolean) => Promise<void>;
  /** Quick-save to the current canonical location; opens nothing if none set. */
  save: () => Promise<void>;
  newFile: () => void;
  forgetLocation: () => void;
  completeSetup: () => void;

  // conflict / sync resolution
  dismissConflict: () => void;
  applyRemoteUpdate: () => Promise<void>;
  dismissRemoteUpdate: () => void;
}

const StorageContext = createContext<StorageContextValue | null>(null);

export function useStorage() {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error("useStorage must be used within StorageProvider");
  return ctx;
}

const NO_LOCATION: StorageLocation = { kind: "none" };

export function StorageProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fileLoaded, setFileLoaded] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [location, setLocation] = useState<StorageLocation>(NO_LOCATION);
  const [driveRef, setDriveRef] = useState<DriveFileRef | null>(null);
  const [storageBusy, setStorageBusy] = useState(false);
  const [storageStatus, setStorageStatus] = useState<string | null>(null);
  const [driveConflict, setDriveConflict] = useState<DriveFileRef | null>(null);
  const [remoteUpdate, setRemoteUpdate] = useState<DriveFileRef | null>(null);
  // Set when the mobile "Open from Drive" flow has more than one candidate and
  // needs the user to choose which budget to open.
  const [driveChooser, setDriveChooser] = useState<DriveFileRef[] | null>(null);

  // In-memory local handle (also persisted to IndexedDB for cross-reload reuse).
  const localHandle = useRef<WritableFileHandle | null>(null);
  // Latest dirty flag for use inside event listeners without re-subscribing.
  const dirtyRef = useRef(false);
  const lastRemoteCheck = useRef(0);

  const store = getStore();

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setDirty(store.dirty);
      dirtyRef.current = store.dirty;
      setDataVersion((n) => n + 1);

      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        autoSave(store.serialize()).catch(() => {});
      }, 2000);
    });
    return unsub;
  }, [store]);

  // Restore content + storage linkage from IndexedDB on mount.
  useEffect(() => {
    Promise.all([
      loadAutoSave(),
      loadDriveRef(),
      loadLocalHandle(),
      loadLocation(),
    ])
      .then(([data, ref, handle, loc]) => {
        if (data && data.transactions?.length > 0) {
          store.load(data);
          store.markClean();
          setFileLoaded(true);
        }
        if (ref) setDriveRef(ref);
        if (handle) localHandle.current = handle;
        if (loc) setLocation(loc);
      })
      .finally(() => setLoading(false));
  }, [store]);

  // Warm up the Google sign-in client on the first user interaction, so that
  // when the user later taps "Open/Save → Google Drive" the token request fires
  // synchronously inside that tap and the sign-in popup is not blocked (the bug
  // that made Drive open silently do nothing on mobile). Loads nothing until the
  // user actually touches the app, and only once.
  useEffect(() => {
    if (!isDriveConfigured()) return;
    let warmed = false;
    const warm = () => {
      if (warmed) return;
      warmed = true;
      void preloadDriveScripts();
      window.removeEventListener("pointerdown", warm);
      window.removeEventListener("keydown", warm);
    };
    window.addEventListener("pointerdown", warm);
    window.addEventListener("keydown", warm);
    return () => {
      window.removeEventListener("pointerdown", warm);
      window.removeEventListener("keydown", warm);
    };
  }, []);

  const markSaved = useCallback(() => {
    store.markClean();
    setDirty(false);
    dirtyRef.current = false;
  }, [store]);

  /** Download a chosen Drive file into the store and make it canonical. */
  const loadDriveFile = useCallback(
    async (token: string, ref: DriveFileRef) => {
      const data = await downloadBudget(token, ref.fileId);
      store.load(data);
      markSaved();
      setFileLoaded(true);
      setDriveRef(ref);
      localHandle.current = null;
      setRemoteUpdate(null);
      const loc: StorageLocation = { kind: "drive", name: ref.name };
      setLocation(loc);
      await Promise.all([
        saveDriveRef(ref),
        saveLocalHandle(null),
        saveLocation(loc),
      ]);
      setStorageStatus(`Opened ${ref.name} from Google Drive`);
    },
    [store, markSaved],
  );

  // --- Open ------------------------------------------------------------------

  const openFromLocal = useCallback(async () => {
    setStorageBusy(true);
    setStorageStatus(null);
    try {
      const res = await openLocalFile();
      if (!res) return;
      store.load(res.data);
      markSaved();
      setFileLoaded(true);
      localHandle.current = res.handle;
      setDriveRef(null);
      setRemoteUpdate(null);
      const loc: StorageLocation = { kind: "local", name: res.name };
      setLocation(loc);
      await Promise.all([
        saveLocalHandle(res.handle),
        saveDriveRef(null),
        saveLocation(loc),
      ]);
      setStorageStatus(`Opened ${res.name} from this device`);
    } catch (e) {
      setStorageStatus(`Couldn't open file: ${(e as Error).message}`);
    } finally {
      setStorageBusy(false);
    }
  }, [store, markSaved]);

  const openFromDrive = useCallback(async () => {
    setStorageBusy(true);
    setStorageStatus(null);
    try {
      // The Google Picker is unreliable on mobile web, so on small screens we
      // list the app's budget files (drive.file scope) and let the user choose
      // in-app. Desktop keeps the richer Picker.
      const useInAppList =
        typeof window !== "undefined" &&
        window.matchMedia("(max-width: 767px)").matches;

      if (useInAppList) {
        const token = await getAccessToken(true);
        const files = await listBudgetFiles(token);
        if (files.length === 0) {
          setStorageStatus(
            "No budget files found in your Drive yet. Save one to Drive first, then it'll show up here.",
          );
          return;
        }
        if (files.length === 1) {
          await loadDriveFile(token, files[0]);
          return;
        }
        setDriveChooser(files); // more than one — let the user pick
        return;
      }

      const { data, ref } = await driveOpen();
      store.load(data);
      markSaved();
      setFileLoaded(true);
      setDriveRef(ref);
      localHandle.current = null;
      setRemoteUpdate(null);
      const loc: StorageLocation = { kind: "drive", name: ref.name };
      setLocation(loc);
      await Promise.all([
        saveDriveRef(ref),
        saveLocalHandle(null),
        saveLocation(loc),
      ]);
      setStorageStatus(`Opened ${ref.name} from Google Drive`);
    } catch (e) {
      if (e instanceof DriveCancelledError) setStorageStatus(null);
      else if (e instanceof DriveAuthError) setStorageStatus(e.message);
      else setStorageStatus(`Couldn't open from Drive: ${(e as Error).message}`);
    } finally {
      setStorageBusy(false);
    }
  }, [store, markSaved, loadDriveFile]);

  /** Open a specific budget the user picked from the mobile Drive chooser. */
  const chooseDriveFile = useCallback(
    async (ref: DriveFileRef) => {
      setDriveChooser(null);
      setStorageBusy(true);
      setStorageStatus(null);
      try {
        const token = await getAccessToken(true);
        await loadDriveFile(token, ref);
      } catch (e) {
        if (e instanceof DriveCancelledError) setStorageStatus(null);
        else if (e instanceof DriveAuthError) setStorageStatus(e.message);
        else
          setStorageStatus(`Couldn't open from Drive: ${(e as Error).message}`);
      } finally {
        setStorageBusy(false);
      }
    },
    [loadDriveFile],
  );

  const cancelDriveChooser = useCallback(() => setDriveChooser(null), []);

  // --- Save ------------------------------------------------------------------

  const saveToLocal = useCallback(async () => {
    setStorageBusy(true);
    setStorageStatus(null);
    try {
      const data = store.serialize();
      const currentName =
        location.kind === "local" ? location.name : undefined;

      // Write back to the existing handle when we have one; otherwise pick.
      if (localHandle.current) {
        const ok = await saveToLocalHandle(localHandle.current, data);
        if (ok) {
          markSaved();
          const loc: StorageLocation = {
            kind: "local",
            name: currentName ?? localHandle.current.name,
          };
          setLocation(loc);
          await saveLocation(loc);
          setStorageStatus(`Saved to this device · ${loc.name}`);
          return;
        }
      }

      const res = await pickAndSaveLocal(data, currentName);
      if (!res) return; // cancelled
      localHandle.current = res.handle;
      setDriveRef(null);
      const loc: StorageLocation = { kind: "local", name: res.name };
      setLocation(loc);
      markSaved();
      await Promise.all([
        saveLocalHandle(res.handle),
        saveDriveRef(null),
        saveLocation(loc),
      ]);
      setStorageStatus(
        res.handle
          ? `Saved to this device · ${res.name}`
          : `Downloaded ${res.name}`,
      );
    } catch (e) {
      setStorageStatus(`Couldn't save file: ${(e as Error).message}`);
    } finally {
      setStorageBusy(false);
    }
  }, [store, location, markSaved]);

  const saveToDrive = useCallback(
    async (force = false) => {
      setStorageBusy(true);
      setStorageStatus(null);
      try {
        const data = store.serialize();
        const name = driveRef?.name ?? "budget.budget";
        const ref = await driveSave(data, driveRef, name, { force });
        setDriveRef(ref);
        localHandle.current = null;
        setDriveConflict(null);
        setRemoteUpdate(null);
        const loc: StorageLocation = { kind: "drive", name: ref.name };
        setLocation(loc);
        markSaved();
        await Promise.all([
          saveDriveRef(ref),
          saveLocalHandle(null),
          saveLocation(loc),
        ]);
        setStorageStatus(`Saved to Google Drive · ${ref.name}`);
      } catch (e) {
        if (e instanceof DriveConflictError) {
          setDriveConflict(e.remote);
          setStorageStatus(null);
        } else if (e instanceof DriveCancelledError) {
          setStorageStatus(null);
        } else if (e instanceof DriveAuthError) {
          setStorageStatus(e.message);
        } else {
          setStorageStatus(`Couldn't save to Drive: ${(e as Error).message}`);
        }
      } finally {
        setStorageBusy(false);
      }
    },
    [store, driveRef, markSaved],
  );

  const save = useCallback(async () => {
    if (location.kind === "drive") return saveToDrive();
    if (location.kind === "local") return saveToLocal();
    // No canonical location yet — the UI surfaces the destination chooser.
  }, [location, saveToDrive, saveToLocal]);

  const newFile = useCallback(() => {
    store.clear();
    markSaved();
    setFileLoaded(true);
    localHandle.current = null;
    setDriveRef(null);
    setRemoteUpdate(null);
    setLocation(NO_LOCATION);
    Promise.all([
      saveLocalHandle(null),
      saveDriveRef(null),
      saveLocation(NO_LOCATION),
    ]).catch(() => {});
  }, [store, markSaved]);

  const forgetLocation = useCallback(() => {
    clearAccessToken();
    localHandle.current = null;
    setDriveRef(null);
    setRemoteUpdate(null);
    setDriveConflict(null);
    setLocation(NO_LOCATION);
    setStorageStatus("Unlinked from this file");
    Promise.all([
      saveLocalHandle(null),
      saveDriveRef(null),
      saveLocation(NO_LOCATION),
    ]).catch(() => {});
  }, []);

  const completeSetup = useCallback(() => {
    setFileLoaded(true);
    autoSave(store.serialize()).catch(() => {});
  }, [store]);

  // --- Conflict / multi-device sync -----------------------------------------

  const dismissConflict = useCallback(() => setDriveConflict(null), []);

  const applyRemoteUpdate = useCallback(async () => {
    const target = remoteUpdate ?? driveConflict ?? driveRef;
    if (!target) return;
    setStorageBusy(true);
    try {
      const token = await getAccessToken(true);
      const data = await downloadBudget(token, target.fileId);
      store.load(data);
      markSaved();
      setDriveRef(target);
      setRemoteUpdate(null);
      setDriveConflict(null);
      await saveDriveRef(target);
      setStorageStatus(`Refreshed to the latest from Drive · ${target.name}`);
    } catch (e) {
      setStorageStatus(`Couldn't refresh from Drive: ${(e as Error).message}`);
    } finally {
      setStorageBusy(false);
    }
  }, [store, remoteUpdate, driveConflict, driveRef, markSaved]);

  const dismissRemoteUpdate = useCallback(() => setRemoteUpdate(null), []);

  // Background check: when a Drive-backed tab regains focus, see if another
  // device pushed a newer version. If we have no unsaved edits, refresh
  // silently; if we do, surface a banner so we never clobber their changes.
  useEffect(() => {
    if (location.kind !== "drive" || !driveRef) return;

    const check = async () => {
      const now = Date.now();
      if (now - lastRemoteCheck.current < 8000) return; // throttle
      lastRemoteCheck.current = now;
      // Only proceed with a warm token — never trigger a (blocked) popup in the
      // background. If there's no token yet, the save-time guard still protects.
      const token = getCachedToken();
      if (!token) return;
      try {
        const meta = await driveMeta(token, driveRef.fileId);
        if (meta.modifiedTime === driveRef.modifiedTime) return;
        if (dirtyRef.current) {
          setRemoteUpdate(meta); // let the user decide
        } else {
          const data = await downloadBudget(token, driveRef.fileId);
          store.load(data);
          markSaved();
          setDriveRef(meta);
          await saveDriveRef(meta);
          setStorageStatus(`Refreshed to the latest from Drive · ${meta.name}`);
        }
      } catch {
        // silent token unavailable / offline — skip quietly
      }
    };

    const onFocus = () => void check();
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    void check(); // also check right after linking
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [location.kind, driveRef, store, markSaved]);

  return (
    <StorageContext.Provider
      value={{
        dirty,
        loading,
        fileLoaded,
        dataVersion,
        location,
        storageBusy,
        storageStatus,
        driveConflict,
        remoteUpdate,
        driveChooser,
        openFromLocal,
        openFromDrive,
        chooseDriveFile,
        cancelDriveChooser,
        saveToLocal,
        saveToDrive,
        save,
        newFile,
        forgetLocation,
        completeSetup,
        dismissConflict,
        applyRemoteUpdate,
        dismissRemoteUpdate,
      }}
    >
      {children}
    </StorageContext.Provider>
  );
}
