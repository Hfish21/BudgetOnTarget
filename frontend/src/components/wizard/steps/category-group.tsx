"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { BudgetTransaction } from "@/lib/local-engine/types";
import { formatCents } from "@/lib/utils";

interface CategoryGroupProps {
  name: string;
  transactions: BudgetTransaction[];
  highlight?: boolean;
}

export function CategoryGroup({ name, transactions, highlight }: CategoryGroupProps) {
  const [expanded, setExpanded] = useState(false);

  const total = transactions.reduce((sum, t) => sum + t.amount_cents, 0);
  const shown = expanded ? transactions.slice(0, 10) : [];

  return (
    <div
      className={`rounded-lg border ${
        highlight ? "border-green-500/30 bg-green-500/5" : "border-border"
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">{name}</span>
          <span className="text-xs text-muted-foreground">
            ({transactions.length})
          </span>
        </div>
        <span className={`text-sm font-mono ${total < 0 ? "text-red-400" : "text-green-400"}`}>
          {formatCents(Math.abs(total))}
        </span>
      </button>

      {expanded && shown.length > 0 && (
        <div className="border-t border-border px-4 py-2 space-y-1">
          {shown.map((txn) => (
            <div
              key={txn.id}
              className="flex items-center justify-between py-1 text-xs"
            >
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground w-20">{txn.date}</span>
                <span className="max-w-[300px] truncate">{txn.description}</span>
              </div>
              <span className="font-mono text-muted-foreground">
                {formatCents(Math.abs(txn.amount_cents))}
              </span>
            </div>
          ))}
          {transactions.length > 10 && (
            <p className="text-xs text-muted-foreground pt-1">
              ...and {transactions.length - 10} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}
