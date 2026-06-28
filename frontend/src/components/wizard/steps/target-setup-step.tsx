"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useWizard, type WizardTargetDraft } from "../wizard-context";
import { TargetSuggestionCard } from "./target-suggestion-card";
import { getStore } from "@/lib/local-engine";
import {
  CATEGORY_SPEND_GROUPS,
} from "@/lib/local-engine/starter-data";
import type { SpendGroup, Direction } from "@/lib/local-engine/types";
import { getGroupLabel } from "@/lib/utils";

function roundTo(cents: number, precision: number): number {
  return Math.round(cents / precision) * precision;
}

export function TargetSetupStep() {
  const { targetDrafts, setTargetDrafts, updateTargetDraft, nextStep, prevStep } =
    useWizard();
  const store = getStore();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const transactions = store.transactions.filter(
      (t) => !t.is_internal_transfer && t.category_id != null
    );

    const monthlyByCategory = new Map<
      number,
      Map<string, number>
    >();

    for (const txn of transactions) {
      const catId = txn.category_id!;
      const month = txn.date.slice(0, 7);
      const catMap = monthlyByCategory.get(catId) ?? new Map<string, number>();
      catMap.set(month, (catMap.get(month) ?? 0) + txn.amount_cents);
      monthlyByCategory.set(catId, catMap);
    }

    const drafts: WizardTargetDraft[] = [];

    for (const [catId, monthMap] of monthlyByCategory) {
      const cat = store.categoryById(catId);
      if (!cat) continue;

      const spendGroup: SpendGroup =
        CATEGORY_SPEND_GROUPS[cat.name] ?? "discretionary";
      const months = Array.from(monthMap.values());
      const avg = months.reduce((s, v) => s + v, 0) / months.length;
      const absAvg = Math.abs(avg);

      if (absAvg < 500) continue;

      const direction: Direction =
        spendGroup === "income" ? "at_least" : "at_most";

      const suggestedCents = roundTo(absAvg, 2500);

      drafts.push({
        categoryId: catId,
        categoryName: cat.name,
        spendGroup,
        suggestedAmountCents: suggestedCents,
        userAmountCents: suggestedCents,
        direction,
        enabled: true,
      });
    }

    drafts.sort((a, b) => {
      const order: Record<SpendGroup, number> = {
        income: 0,
        necessary: 1,
        discretionary: 2,
        anomalous: 3,
      };
      return (order[a.spendGroup] ?? 9) - (order[b.spendGroup] ?? 9);
    });

    setTargetDrafts(drafts);
  }, [store, setTargetDrafts]);

  function handleCommit() {
    for (const draft of targetDrafts) {
      if (!draft.enabled) continue;

      const tolerance = roundTo(draft.userAmountCents * 0.1, 1000);

      store.addTarget({
        name: draft.categoryName,
        target_type: "monetary",
        direction: draft.direction,
        value: draft.userAmountCents,
        tolerance_upper: tolerance,
        tolerance_lower: tolerance,
        period: "monthly",
        person_scope: null,
        category_id: draft.categoryId,
        description_pattern: null,
        spend_group: draft.spendGroup,
        is_active: true,
      });
    }

    nextStep();
  }

  const groups = new Map<SpendGroup, WizardTargetDraft[]>();
  for (const d of targetDrafts) {
    const list = groups.get(d.spendGroup) ?? [];
    list.push(d);
    groups.set(d.spendGroup, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Set budget targets</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Based on your spending history, here are suggested monthly targets.
          Toggle them on/off and adjust the amounts.
        </p>
      </div>

      {targetDrafts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Not enough transaction data to suggest targets. You can set them up
          later from the Targets page.
        </p>
      ) : (
        Array.from(groups.entries()).map(([group, drafts]) => (
          <div key={group} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              {getGroupLabel(group)}
            </h3>
            {drafts.map((d) => (
              <TargetSuggestionCard
                key={d.categoryId}
                draft={d}
                onUpdate={(updates) =>
                  updateTargetDraft(d.categoryId, updates)
                }
              />
            ))}
          </div>
        ))
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={prevStep}>
          Back
        </Button>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={nextStep}>
            Skip for now
          </Button>
          <Button onClick={handleCommit}>
            {targetDrafts.filter((d) => d.enabled).length > 0
              ? "Save targets & Continue"
              : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
