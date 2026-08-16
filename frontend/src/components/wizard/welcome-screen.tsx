"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, HardDrive, Cloud } from "lucide-react";
import { isDriveConfigured } from "@/lib/drive/config";

interface WelcomeScreenProps {
  onOpenFromLocal: () => void;
  onOpenFromDrive: () => void;
  onStartWizard: () => void;
}

export function WelcomeScreen({
  onOpenFromLocal,
  onOpenFromDrive,
  onStartWizard,
}: WelcomeScreenProps) {
  const driveOn = isDriveConfigured();

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
            of your finances. Everything runs in your browser — your data stays
            with you.
          </p>
        </div>

        <Card
          className="cursor-pointer border-primary/50 text-left transition-colors hover:border-primary"
          onClick={onStartWizard}
        >
          <CardContent className="flex items-center gap-4 py-5">
            <Sparkles className="size-8 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">Get started</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Import your bank CSV and set up your budget from scratch
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground/70">
              or open an existing budget
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className={driveOn ? "grid gap-3 sm:grid-cols-2" : ""}>
            <button
              onClick={onOpenFromLocal}
              className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground"
            >
              <HardDrive className="size-4" />
              This device
            </button>
            {driveOn && (
              <button
                onClick={onOpenFromDrive}
                className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground"
              >
                <Cloud className="size-4" />
                Google Drive
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground/60">BudgetOnTarget v0.1.0</p>
      </div>
    </div>
  );
}
