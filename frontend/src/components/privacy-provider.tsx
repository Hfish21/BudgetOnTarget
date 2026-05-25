"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface PrivacyContextValue {
  privacyMode: boolean;
  togglePrivacy: () => void;
}

const PrivacyContext = createContext<PrivacyContextValue>({
  privacyMode: false,
  togglePrivacy: () => {},
});

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [privacyMode, setPrivacyMode] = useState(false);
  const togglePrivacy = useCallback(() => setPrivacyMode((p) => !p), []);

  return (
    <PrivacyContext.Provider value={{ privacyMode, togglePrivacy }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  return useContext(PrivacyContext);
}
