"use client";

import { Suspense, useState } from "react";
import { useStorage } from "@/components/storage-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileChrome } from "@/components/layout/mobile-chrome";
import { DriveChooser } from "@/components/layout/drive-chooser";
import { WelcomeScreen } from "@/components/wizard/welcome-screen";
import { SetupWizard } from "@/components/wizard/setup-wizard";
import { WizardProvider } from "@/components/wizard/wizard-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { fileLoaded, loading, openFromLocal, openFromDrive } = useStorage();
  const [showWizard, setShowWizard] = useState(false);

  let body: React.ReactNode;
  if (loading) {
    body = (
      <div className="flex min-h-screen items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  } else if (!fileLoaded && !showWizard) {
    body = (
      <WelcomeScreen
        onOpenFromLocal={openFromLocal}
        onOpenFromDrive={openFromDrive}
        onStartWizard={() => setShowWizard(true)}
      />
    );
  } else if (!fileLoaded && showWizard) {
    body = (
      <WizardProvider>
        <SetupWizard />
      </WizardProvider>
    );
  } else {
    body = (
      <>
        <Suspense>
          <Sidebar />
          <MobileChrome />
        </Suspense>
        <main className="min-h-screen px-4 pt-[4.5rem] pb-24 md:ml-60 md:px-6 md:pt-6 md:pb-6">
          {children}
        </main>
      </>
    );
  }

  // The mobile Drive chooser must be reachable from every state (including the
  // first-run welcome screen), so it lives above the branch.
  return (
    <>
      {body}
      <DriveChooser />
    </>
  );
}
