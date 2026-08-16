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
  openBudgetFile,
  saveBudgetFile,
} from "@/lib/local-engine/file-io";

interface StorageContextValue {
  dirty: boolean;
  loading: boolean;
  fileLoaded: boolean;
  dataVersion: number;
  openFile: () => Promise<void>;
  saveFile: () => Promise<void>;
  newFile: () => void;
  completeSetup: () => void;
}

const StorageContext = createContext<StorageContextValue | null>(null);

export function useStorage() {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error("useStorage must be used within StorageProvider");
  return ctx;
}

export function StorageProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fileLoaded, setFileLoaded] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Try loading from IndexedDB on mount
  useEffect(() => {
    loadAutoSave()
      .then((data) => {
        if (data && data.transactions?.length > 0) {
          store.load(data);
          store.markClean();
          setFileLoaded(true);
        }
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
  }, [store]);

  const completeSetup = useCallback(() => {
    setFileLoaded(true);
    autoSave(store.serialize()).catch(() => {});
  }, [store]);

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
      }}
    >
      {children}
    </StorageContext.Provider>
  );
}
