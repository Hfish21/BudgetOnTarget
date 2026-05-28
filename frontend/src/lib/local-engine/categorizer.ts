import type { BudgetCategoryRule } from "./types";

export function categorize(
  description: string,
  rules: BudgetCategoryRule[]
): number | null {
  const activeRules = rules
    .filter((r) => r.is_active)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of activeRules) {
    if (rule.match_type === "substring") {
      if (description.toUpperCase().includes(rule.pattern.toUpperCase())) {
        return rule.category_id;
      }
    } else if (rule.match_type === "regex") {
      try {
        if (new RegExp(rule.pattern, "i").test(description)) {
          return rule.category_id;
        }
      } catch {
        // Invalid regex — skip
      }
    }
  }
  return null;
}

export function recategorizeAll(store: {
  transactions: { description: string; category_id: number | null; is_manually_categorized: boolean }[];
  categoryRules: BudgetCategoryRule[];
}): number {
  let updated = 0;
  for (const txn of store.transactions) {
    if (txn.is_manually_categorized) continue;
    const newCatId = categorize(txn.description, store.categoryRules);
    if (newCatId !== txn.category_id) {
      txn.category_id = newCatId;
      updated++;
    }
  }
  return updated;
}
