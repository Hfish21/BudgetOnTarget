"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useWizard } from "../wizard-context";
import { CategoryGroup } from "./category-group";
import { QuickCategorizeRow } from "./quick-categorize-row";
import { getStore } from "@/lib/local-engine";
import {
  installStarterData,
  applyStarterRulesToTransactions,
  CATEGORY_SPEND_GROUPS,
} from "@/lib/local-engine/starter-data";
import type { BudgetTransaction } from "@/lib/local-engine/types";

export function CategoryReviewStep() {
  const { nextStep, prevStep } = useWizard();
  const store = getStore();
  const installedRef = useRef(false);
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (installedRef.current) return;
    installedRef.current = true;
    installStarterData(store);
    applyStarterRulesToTransactions(store);
    setVersion((v) => v + 1);
  }, [store]);

  const categories = store.categories;
  const transactions = store.transactions;

  const categorized = new Map<number, BudgetTransaction[]>();
  const uncategorized: BudgetTransaction[] = [];
  const incomeTransactions: BudgetTransaction[] = [];

  for (const txn of transactions) {
    if (txn.is_internal_transfer) continue;

    if (txn.category_id == null) {
      uncategorized.push(txn);
      continue;
    }

    const cat = categories.find((c) => c.id === txn.category_id);
    if (cat && CATEGORY_SPEND_GROUPS[cat.name] === "income") {
      incomeTransactions.push(txn);
    }

    const list = categorized.get(txn.category_id) ?? [];
    list.push(txn);
    categorized.set(txn.category_id, list);
  }

  const totalNonTransfer = transactions.filter((t) => !t.is_internal_transfer).length;
  const categorizedCount = totalNonTransfer - uncategorized.length;

  function handleCategorize(transactionId: number, categoryId: number) {
    store.updateTransaction(transactionId, {
      category_id: categoryId,
      is_manually_categorized: true,
    });

    const txn = store.transactions.find((t) => t.id === transactionId);
    if (!txn) return;

    const similar = store.transactions.filter(
      (t) =>
        t.id !== transactionId &&
        t.category_id == null &&
        !t.is_manually_categorized &&
        t.description === txn.description
    );

    for (const sim of similar) {
      store.updateTransaction(sim.id, {
        category_id: categoryId,
        is_manually_categorized: true,
      });
    }

    setVersion((v) => v + 1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Review categories</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We categorized{" "}
          <span className="font-medium text-foreground">{categorizedCount}</span>{" "}
          of {totalNonTransfer} transactions using common merchant rules. Review
          below and assign any uncategorized ones.
        </p>
      </div>

      {incomeTransactions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-green-400">Income</h3>
          {categories
            .filter((c) => CATEGORY_SPEND_GROUPS[c.name] === "income")
            .map((cat) => {
              const txns = categorized.get(cat.id);
              if (!txns || txns.length === 0) return null;
              return (
                <CategoryGroup
                  key={cat.id}
                  name={cat.name}
                  transactions={txns}
                  highlight
                />
              );
            })}
        </div>
      )}

      {categories
        .filter((c) => CATEGORY_SPEND_GROUPS[c.name] !== "income")
        .map((cat) => {
          const txns = categorized.get(cat.id);
          if (!txns || txns.length === 0) return null;
          return (
            <CategoryGroup key={cat.id} name={cat.name} transactions={txns} />
          );
        })}

      {uncategorized.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">
            Uncategorized ({uncategorized.length})
          </h3>
          <div className="rounded-lg border border-border p-4 max-h-80 overflow-y-auto space-y-0.5">
            {uncategorized.slice(0, 50).map((txn) => (
              <QuickCategorizeRow
                key={txn.id}
                transaction={txn}
                categories={categories}
                onCategorize={handleCategorize}
              />
            ))}
            {uncategorized.length > 50 && (
              <p className="text-xs text-muted-foreground pt-2">
                Showing 50 of {uncategorized.length}. You can categorize the
                rest from the Transactions page later.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={prevStep}>
          Back
        </Button>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={nextStep}>
            Skip for now
          </Button>
          <Button onClick={nextStep}>Continue</Button>
        </div>
      </div>
    </div>
  );
}
