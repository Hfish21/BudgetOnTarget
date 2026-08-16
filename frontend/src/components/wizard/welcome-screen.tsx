"use client";

import { Card, CardContent } from "@/components/ui/card";
import { FolderOpen, Sparkles, CloudDownload } from "lucide-react";
import { isDriveConfigured } from "@/lib/drive/config";

interface WelcomeScreenProps {
  onOpenFile: () => void;
  onOpenFromDrive: () => void;
  onStartWizard: () => void;
}

export function WelcomeScreen({
  onOpenFile,
  onOpenFromDrive,
  onStartWizard,
}: WelcomeScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-8 text-center">
        <div className="space-y-3">
          <div className="flex justify-center">
            <img src="/logo.svg" alt="" className="size-14" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome to BudgetOnTarget
          </h1>
          <p className="text-muted-foreground">
            Track your household spending, set budget targets, and stay on top
            of your finances. Everything runs in your browser — your data never
            leaves your device.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card
            className="cursor-pointer transition-colors hover:border-muted-foreground/50"
            onClick={onOpenFile}
          >
            <CardContent className="flex flex-col items-center gap-3 pt-6 pb-6">
              <FolderOpen className="size-8 text-muted-foreground" />
              <div>
                <p className="font-semibold">Open existing file</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Load a .budget file you&apos;ve saved before
                </p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer border-primary/50 transition-colors hover:border-primary"
            onClick={onStartWizard}
          >
            <CardContent className="flex flex-col items-center gap-3 pt-6 pb-6">
              <Sparkles className="size-8 text-primary" />
              <div>
                <p className="font-semibold">Get started</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Import your bank CSV and set up your budget
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {isDriveConfigured() && (
          <button
            onClick={onOpenFromDrive}
            className="mx-auto flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-accent-foreground"
          >
            <CloudDownload className="size-4" />
            Open from Google Drive
          </button>
        )}

        <p className="text-xs text-muted-foreground/60">
          BudgetOnTarget v0.1.0
        </p>
      </div>
    </div>
  );
}
