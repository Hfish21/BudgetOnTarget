"use client";

import type { BudgetCategory, BudgetTransaction } from "@/lib/local-engine/types";
import { formatCents } from "@/lib/utils";

interface QuickCategorizeRowProps {
  transaction: BudgetTransaction;
  categories: BudgetCategory[];
  onCategorize: (transactionId: number, categoryId: number) => void;
}

export function QuickCategorizeRow({
  transaction,
  categories,
  onCategorize,
}: QuickCategorizeRowProps) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-20 shrink-0 text-xs text-muted-foreground">
        {transaction.date}
      </span>
      <span className="flex-1 truncate text-xs">{transaction.description}</span>
      <span className="w-20 shrink-0 text-right text-xs font-mono text-muted-foreground">
        {formatCents(Math.abs(transaction.amount_cents))}
      </span>
      <select
        value=""
        onChange={(e) => {
          const catId = parseInt(e.target.value, 10);
          if (!isNaN(catId)) onCategorize(transaction.id, catId);
        }}
        className="h-7 w-40 shrink-0 rounded border border-input bg-card px-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">Assign...</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
