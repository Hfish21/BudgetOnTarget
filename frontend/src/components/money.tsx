"use client";

import { usePrivacy } from "./privacy-provider";

interface MoneyProps {
  children: React.ReactNode;
  className?: string;
}

export function Money({ children, className }: MoneyProps) {
  const { privacyMode } = usePrivacy();

  return (
    <span
      className={className}
      style={privacyMode ? { filter: "blur(8px)", userSelect: "none" } : undefined}
    >
      {children}
    </span>
  );
}
