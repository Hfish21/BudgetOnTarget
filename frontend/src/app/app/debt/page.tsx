"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useStorage } from "@/components/storage-provider";
import { DebtForm } from "@/components/debt/debt-form";
import { DebtDetail } from "@/components/debt/debt-detail";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/money";
import {
  formatCents,
  getDebtStatusLabel,
  getDebtStatusBgColor,
} from "@/lib/utils";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Debt, DebtStatus } from "@/types";

interface DebtSummary {
  status: DebtStatus;
  current_balance_cents: number;
  projected_payoff_label: string | null;
  is_paid_off: boolean;
}

export default function DebtPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [summaries, setSummaries] = useState<Record<number, DebtSummary>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { dataVersion } = useStorage();

  const fetchDebts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.debts.list();
      setDebts(data);
      setSelectedId((prev) =>
        prev != null && data.some((d) => d.id === prev)
          ? prev
          : (data[0]?.id ?? null)
      );

      const entries = await Promise.all(
        data.map(async (d) => {
          const t = await api.debts.getTrajectory(d.id);
          return [
            d.id,
            {
              status: t.status,
              current_balance_cents: t.current_balance_cents,
              projected_payoff_label: t.projected_payoff_label,
              is_paid_off: t.is_paid_off,
            } as DebtSummary,
          ] as const;
        })
      );
      setSummaries(Object.fromEntries(entries));
    } catch {
      /* non-critical */
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch on mount and whenever the store changes (e.g. opening a file, or
  // categorizing a payment elsewhere) — dataVersion is the app's store-change signal.
  useEffect(() => {
    fetchDebts();
  }, [fetchDebts, dataVersion]);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this card? Your transactions are untouched.")) return;
    try {
      await api.debts.delete(id);
      fetchDebts();
    } catch {
      /* ignore */
    }
  };

  const handleSave = () => {
    setShowForm(false);
    setEditingDebt(null);
    setRefreshKey((k) => k + 1);
    fetchDebts();
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingDebt(null);
  };

  const formOpen = showForm || editingDebt != null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Debt Trajectory</h2>
          <p className="text-sm text-muted-foreground">
            Track credit card payoff and see whether you&rsquo;re on track,
            ahead, or behind.
          </p>
        </div>
        {!formOpen && (
          <Button
            onClick={() => {
              setShowForm(true);
              setEditingDebt(null);
            }}
          >
            <Plus className="mr-1 size-4" />
            Add Card
          </Button>
        )}
      </div>

      {formOpen && (
        <DebtForm
          debt={editingDebt}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : debts.length === 0 ? (
        !formOpen && (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No cards yet. Click &ldquo;Add Card&rdquo; to set up your first
              payoff tracker — you&rsquo;ll need one recent statement&rsquo;s
              balance, the APR, and the minimum payment.
            </p>
          </div>
        )
      ) : (
        <>
          {/* Selectable card summaries */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {debts.map((debt) => {
              const s = summaries[debt.id];
              const selected = debt.id === selectedId;
              return (
                <button
                  key={debt.id}
                  onClick={() => setSelectedId(debt.id)}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    selected
                      ? "border-primary bg-accent/40 ring-2 ring-primary/20"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{debt.name}</p>
                      {!debt.is_active && (
                        <Badge
                          variant="outline"
                          className="mt-1 text-xs text-muted-foreground"
                        >
                          Inactive
                        </Badge>
                      )}
                    </div>
                    {s && (
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${getDebtStatusBgColor(
                          s.status
                        )}`}
                      >
                        {getDebtStatusLabel(s.status)}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Balance now</p>
                      <p className="text-lg font-semibold tracking-tight">
                        <Money>
                          {formatCents(s?.current_balance_cents ?? debt.anchor_balance_cents)}
                        </Money>
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingDebt(debt);
                          setShowForm(false);
                        }}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Pencil className="size-3.5" />
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(debt.id);
                        }}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </span>
                    </div>
                  </div>
                  {s?.projected_payoff_label && !s.is_paid_off && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Projected payoff {s.projected_payoff_label}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Detail for the selected card */}
          {selectedId != null && (
            <DebtDetail debtId={selectedId} refreshKey={refreshKey + dataVersion} />
          )}
        </>
      )}
    </div>
  );
}
