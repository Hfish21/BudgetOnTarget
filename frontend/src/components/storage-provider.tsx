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
import { setActiveApi, remoteApi } from "@/lib/api";
import { localApi, getStore } from "@/lib/local-engine";
import {
  autoSave,
  loadAutoSave,
  openBudgetFile,
  saveBudgetFile,
} from "@/lib/local-engine/file-io";

type StorageMode = "remote" | "local";

interface StorageContextValue {
  mode: StorageMode;
  setMode: (m: StorageMode) => void;
  dirty: boolean;
  fileLoaded: boolean;
  dataVersion: number;
  openFile: () => Promise<void>;
  saveFile: () => Promise<void>;
  newFile: () => void;
}

const StorageContext = createContext<StorageContextValue | null>(null);

export function useStorage() {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error("useStorage must be used within StorageProvider");
  return ctx;
}

export function StorageProvider({ children }: { children: ReactNode }) {
  const [mode, setModeRaw] = useState<StorageMode>("local");
  const [dirty, setDirty] = useState(false);
  const [fileLoaded, setFileLoaded] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const store = getStore();

  const setMode = useCallback(
    (m: StorageMode) => {
      setModeRaw(m);
      setActiveApi(m === "remote" ? remoteApi : localApi);
    },
    []
  );

  // Set initial API
  useEffect(() => {
    setActiveApi(mode === "remote" ? remoteApi : localApi);
  }, [mode]);

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

  // Try loading from IndexedDB on mount
  useEffect(() => {
    loadAutoSave().then((data) => {
      if (data && data.transactions?.length > 0) {
        store.load(data);
        store.markClean();
        setFileLoaded(true);
      }
    });
  }, [store]);

  const openFile = useCallback(async () => {
    const data = await openBudgetFile();
    if (data) {
      store.load(data);
      store.markClean();
      setDirty(false);
      setFileLoaded(true);
      setModeRaw("local");
      setActiveApi(localApi);
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
    setModeRaw("local");
    setActiveApi(localApi);
  }, [store]);

  return (
    <StorageContext.Provider
      value={{
        mode,
        setMode,
        dirty,
        fileLoaded,
        dataVersion,
        openFile,
        saveFile,
        newFile,
      }}
    >
      {children}
    </StorageContext.Provider>
  );
}
