"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useWizard } from "../wizard-context";
import { getStore } from "@/lib/local-engine";
import { CATEGORY_SPEND_GROUPS } from "@/lib/local-engine/starter-data";
import { formatCents } from "@/lib/utils";

export function SummaryStep() {
  const { nextStep, prevStep } = useWizard();
  const store = getStore();

  const transactions = store.transactions.filter((t) => !t.is_internal_transfer);
  const incomeTransactions = transactions.filter((t) => {
    if (t.category_id == null) return false;
    const cat = store.categoryById(t.category_id);
    return cat && CATEGORY_SPEND_GROUPS[cat.name] === "income";
  });

  const months = new Set(transactions.map((t) => t.date.slice(0, 7)));
  const monthCount = months.size || 1;

  const totalIncome = incomeTransactions.reduce(
    (s, t) => s + t.amount_cents,
    0
  );
  const avgMonthlyIncome = Math.round(totalIncome / monthCount);

  const totalExpenses = transactions
    .filter((t) => t.amount_cents < 0)
    .reduce((s, t) => s + t.amount_cents, 0);
  const avgMonthlyExpenses = Math.round(Math.abs(totalExpenses) / monthCount);

  const categorizedCount = transactions.filter(
    (t) => t.category_id != null
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Review your setup</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s a summary of everything. Make sure it looks right before
          finishing.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Accounts</p>
            <p className="text-2xl font-bold">{store.accounts.length}</p>
            <div className="mt-2 space-y-1">
              {store.accounts.map((a) => (
                <p key={a.id} className="text-xs text-muted-foreground">
                  {a.name} ({a.institution || a.account_type})
                </p>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Transactions</p>
            <p className="text-2xl font-bold">{transactions.length}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {categorizedCount} categorized &middot;{" "}
              {transactions.length - categorizedCount} uncategorized
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">
              Avg monthly income
            </p>
            <p className="text-2xl font-bold text-green-400">
              {formatCents(avgMonthlyIncome)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Based on {monthCount} month{monthCount !== 1 ? "s" : ""} of data
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">
              Avg monthly expenses
            </p>
            <p className="text-2xl font-bold text-red-400">
              {formatCents(avgMonthlyExpenses)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Net: {formatCents(Math.abs(avgMonthlyIncome - avgMonthlyExpenses))}{" "}
              {avgMonthlyIncome >= avgMonthlyExpenses ? "surplus" : "deficit"} /
              month
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Categories</p>
            <p className="text-2xl font-bold">{store.categories.length}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {store.categoryRules.length} auto-categorization rules
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Budget targets</p>
            <p className="text-2xl font-bold">{store.targets.length}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {store.targets.filter((t) => t.is_active).length} active
            </p>
          </CardContent>
        </Card>
      </div>

      {incomeTransactions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Income transactions</h3>
          <div className="rounded-lg border border-border p-3 max-h-48 overflow-y-auto space-y-1">
            {incomeTransactions.slice(0, 20).map((txn) => (
              <div
                key={txn.id}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex gap-3">
                  <span className="text-muted-foreground w-20">
                    {txn.date}
                  </span>
                  <span className="truncate max-w-[250px]">
                    {txn.description}
                  </span>
                </div>
                <span className="font-mono text-green-400">
                  {formatCents(txn.amount_cents)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={prevStep}>
          Back
        </Button>
        <Button onClick={nextStep}>Looks good</Button>
      </div>
    </div>
  );
}
