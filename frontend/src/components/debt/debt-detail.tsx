"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Money } from "@/components/money";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DebtTrajectoryChart } from "@/components/debt/debt-trajectory-chart";
import {
  formatCents,
  getDebtStatusLabel,
  getDebtStatusBgColor,
  getDebtStatusTextColor,
} from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import type { DebtTrajectory, DebtScenario } from "@/types";

interface DebtDetailProps {
  debtId: number;
  refreshKey: number;
}

function driftPhrase(drift: number | null): string {
  if (drift == null) return "";
  if (drift > 0) return `${drift} month${drift === 1 ? "" : "s"} later than plan`;
  if (drift < 0) return `${-drift} month${-drift === 1 ? "" : "s"} ahead of plan`;
  return "right on plan";
}

export function DebtDetail({ debtId, refreshKey }: DebtDetailProps) {
  const [trajectory, setTrajectory] = useState<DebtTrajectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [extraDollars, setExtraDollars] = useState("0");
  const [scenario, setScenario] = useState<DebtScenario | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.debts
      .getTrajectory(debtId)
      .then((t) => {
        if (!alive) return;
        setTrajectory(t);
        setExtraDollars((t.extra_payment_cents / 100).toFixed(0));
      })
      .catch(() => {
        /* non-critical */
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [debtId, refreshKey]);

  const runScenario = useCallback(
    (dollars: string) => {
      const extraCents = Math.max(0, Math.round(parseFloat(dollars || "0") * 100));
      if (Number.isNaN(extraCents)) return;
      api.debts
        .getScenario(debtId, extraCents)
        .then(setScenario)
        .catch(() => {
          /* non-critical */
        });
    },
    [debtId]
  );

  useEffect(() => {
    if (trajectory) runScenario(extraDollars);
  }, [trajectory, extraDollars, runScenario]);

  if (loading || !trajectory) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  const t = trajectory;
  const headline = t.never_pays_off
    ? "The minimum payment doesn't cover the monthly interest — this balance won't pay off. Increase the payment."
    : t.is_paid_off
      ? "Paid off — nice work."
      : t.projected_payoff_label
        ? `Projected payoff ${t.projected_payoff_label}`
        : "Projected payoff — enter your payments to see it";

  return (
    <div className="space-y-6">
      {/* Status headline */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white ${getDebtStatusBgColor(
              t.status
            )}`}
          >
            {getDebtStatusLabel(t.status)}
          </span>
          {!t.never_pays_off && !t.is_paid_off && t.date_drift_months != null && (
            <span className={`text-sm font-medium ${getDebtStatusTextColor(t.status)}`}>
              {driftPhrase(t.date_drift_months)}
            </span>
          )}
        </div>
        <p className="mt-2 text-lg font-semibold tracking-tight">{headline}</p>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Estimated balance now">
          <Money>{formatCents(t.current_balance_cents)}</Money>
        </Stat>
        <Stat label="Projected payoff">
          {t.projected_payoff_label ?? "—"}
        </Stat>
        <Stat label="Months remaining">
          {t.months_remaining != null ? String(t.months_remaining) : "—"}
        </Stat>
        <Stat label="Interest left (on plan)">
          {t.total_interest_remaining_cents != null ? (
            <Money>{formatCents(t.total_interest_remaining_cents)}</Money>
          ) : (
            "—"
          )}
        </Stat>
      </div>

      {/* Assumption note */}
      <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
        <p>
          This projects the payoff of your{" "}
          <span className="font-medium text-foreground">
            <Money>{formatCents(t.anchor_balance_cents)}</Money> anchor balance
          </span>{" "}
          from {t.anchor_date}. New purchases on the card aren&rsquo;t tracked, so
          if you&rsquo;re still spending on it, edit the card to re-anchor from a
          fresh statement.
          {t.min_payment_percent != null && (
            <>
              {" "}
              Your minimum (<Money>{formatCents(t.min_payment_cents)}</Money>) is
              about {t.min_payment_percent}% of the current balance.
            </>
          )}
        </p>
      </div>

      {/* Trajectory chart */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="mb-4 text-sm font-semibold">Balance over time</p>
        <DebtTrajectoryChart trajectory={t} />
      </div>

      {/* Scenario explorer */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-semibold">What if I pay extra?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          On top of the <Money>{formatCents(t.min_payment_cents)}</Money> minimum,
          each month.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">$</span>
            <Input
              type="number"
              min="0"
              step="25"
              value={extraDollars}
              onChange={(e) => setExtraDollars(e.target.value)}
              className="w-28"
            />
            <span className="text-sm text-muted-foreground">/ mo extra</span>
          </div>
          {[50, 100, 200].map((amt) => (
            <Button
              key={amt}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setExtraDollars(String(amt))}
            >
              +${amt}
            </Button>
          ))}
        </div>

        {scenario && (
          <div className="mt-4 rounded-lg bg-muted/40 p-4 text-sm">
            {scenario.never_pays_off ? (
              <p className="text-red-600 dark:text-red-400">
                Even at{" "}
                <Money>{formatCents(scenario.monthly_payment_cents)}</Money>/mo,
                this doesn&rsquo;t cover the interest — the balance won&rsquo;t pay
                off.
              </p>
            ) : (
              <p>
                Paying{" "}
                <span className="font-semibold">
                  <Money>{formatCents(scenario.monthly_payment_cents)}</Money>/mo
                </span>{" "}
                pays this off{" "}
                <span className="font-semibold">{scenario.payoff_label}</span>
                {scenario.months_remaining != null && (
                  <> ({scenario.months_remaining} months)</>
                )}
                {scenario.interest_saved_cents > 0 && (
                  <>
                    {" "}
                    — saving{" "}
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      <Money>{formatCents(scenario.interest_saved_cents)}</Money>
                    </span>{" "}
                    in interest vs. the minimum.
                  </>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Month-by-month strip */}
      {t.months.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-3 text-sm font-semibold">Month by month</p>
          <div className="flex flex-wrap gap-1.5">
            {t.months.map((m) => (
              <div
                key={m.month_key}
                title={`${m.label}: ${getDebtStatusLabel(m.status)} — ${formatCents(
                  m.actual_balance
                )} vs plan ${formatCents(m.planned_balance)}`}
                className="flex flex-col items-center gap-1"
              >
                <span
                  className={`size-6 rounded-md ${getDebtStatusBgColor(m.status)}`}
                />
                <span className="text-[9px] text-muted-foreground">
                  {m.label.slice(0, 3)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight">{children}</p>
    </div>
  );
}
