import type { Metadata } from "next";
import { PrivacyProvider } from "@/components/privacy-provider";
import { AppShell } from "@/components/layout/app-shell";
import { StorageProvider } from "@/components/storage-provider";
import { LoggerInit } from "@/components/logger-init";

export const metadata: Metadata = {
  title: "BudgetOnTarget",
  description: "Personal household spending dashboard",
};

/**
 * Everything under /app runs against the local engine, so this is where the
 * store and the app chrome mount. Routes outside this segment (the landing
 * page) never pay for them.
 */
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <StorageProvider>
      <LoggerInit />
      <PrivacyProvider>
        <AppShell>{children}</AppShell>
      </PrivacyProvider>
    </StorageProvider>
  );
}
