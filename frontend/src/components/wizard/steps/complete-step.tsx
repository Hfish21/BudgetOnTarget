"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { useStorage } from "@/components/storage-provider";
import { getStore } from "@/lib/local-engine";

export function CompleteStep() {
  const { completeSetup } = useStorage();
  const store = getStore();

  const txnCount = store.transactions.length;
  const accountCount = store.accounts.length;
  const catCount = store.categories.length;
  const ruleCount = store.categoryRules.length;
  const targetCount = store.targets.filter((t) => t.is_active).length;

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
      <CheckCircle className="size-16 text-green-500" />

      <div className="space-y-2">
        <h2 className="text-2xl font-bold">You&apos;re all set!</h2>
        <p className="text-muted-foreground max-w-md">
          Your budget is configured and ready to use.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <span className="text-right text-muted-foreground">Transactions</span>
        <span className="text-left font-medium">{txnCount}</span>
        <span className="text-right text-muted-foreground">Accounts</span>
        <span className="text-left font-medium">{accountCount}</span>
        <span className="text-right text-muted-foreground">Categories</span>
        <span className="text-left font-medium">
          {catCount} with {ruleCount} rules
        </span>
        <span className="text-right text-muted-foreground">Targets</span>
        <span className="text-left font-medium">{targetCount} active</span>
      </div>

      <Button size="lg" onClick={completeSetup}>
        Go to Dashboard
      </Button>

      <p className="text-xs text-muted-foreground">
        Your data is auto-saved in the browser. Use the Save button in the
        sidebar to export a .budget file for backup.
      </p>
    </div>
  );
}
