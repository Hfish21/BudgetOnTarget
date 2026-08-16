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
  cn,
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
  const [extraDollars, setExtraDollars] = useState("0");
  const [scenario, setScenario] = useState<DebtScenario | null>(null);

  // Future-spend assumption for the projection: "stop" = $0/mo, "keep" = a
  // monthly amount (prefilled from recent spend). History/status ignore this.
  const [spendMode, setSpendMode] = useState<"stop" | "keep">("stop");
  const [keepSpendDollars, setKeepSpendDollars] = useState("");
  const futureSpendCents =
    spendMode === "keep"
      ? Math.max(0, Math.round(parseFloat(keepSpendDollars || "0") * 100))
      : 0;

  useEffect(() => {
    let alive = true;
    // Note: we intentionally do NOT clear `trajectory` or show a skeleton on
    // refetch — that would unmount the inputs (stealing focus mid-typing) and
    // flicker the chart. The stale trajectory stays visible until the new one
    // arrives; the render guard below only shows a skeleton before the first
    // load or when switching to a different card.
    api.debts
      .getTrajectory(debtId, futureSpendCents)
      .then((t) => {
        if (!alive) return;
        setTrajectory(t);
        setExtraDollars((prev) =>
          prev === "0" ? (t.extra_payment_cents / 100).toFixed(0) : prev
        );
        setKeepSpendDollars((prev) =>
          prev === "" ? (t.recent_monthly_spend_cents / 100).toFixed(0) : prev
        );
      })
      .catch(() => {
        /* non-critical */
      });
    return () => {
      alive = false;
    };
  }, [debtId, refreshKey, futureSpendCents]);

  const runScenario = useCallback(
    (dollars: string) => {
      const extraCents = Math.max(0, Math.round(parseFloat(dollars || "0") * 100));
      if (Number.isNaN(extraCents)) return;
      api.debts
        .getScenario(debtId, extraCents, futureSpendCents)
        .then(setScenario)
        .catch(() => {
          /* non-critical */
        });
    },
    [debtId, futureSpendCents]
  );

  useEffect(() => {
    if (trajectory) runScenario(extraDollars);
  }, [trajectory, extraDollars, runScenario]);

  // Skeleton only before the first load or while switching to another card —
  // never on an in-place refetch (typing a spend amount, toggling assumptions).
  if (!trajectory || trajectory.debt_id !== debtId) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  const t = trajectory;
  const payoffText = t.never_pays_off
    ? "Never at this rate"
    : (t.projected_payoff_label ?? "—");
  const headline = t.never_pays_off
    ? spendMode === "keep"
      ? "At your recent spending, this balance never gets paid off — spending outpaces the payment."
      : "The minimum payment doesn't cover the monthly interest — this balance won't pay off. Increase the payment."
    : t.is_paid_off
      ? "Paid off — nice work."
      : t.projected_payoff_label
        ? `Projected payoff ${t.projected_payoff_label}`
        : "Projected payoff — enter your payments to see it";

  // The scenario line is drawn only when the explored payment differs from the
  // current plan (min + configured extra) and actually pays off.
  const planPayment = t.min_payment_cents + t.extra_payment_cents;
  const scenarioAhead = scenario ? scenario.monthly_payment_cents > planPayment : true;
  const showScenarioLine =
    !!scenario && !scenario.never_pays_off && scenario.monthly_payment_cents !== planPayment;

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
        <Stat label="Projected payoff">{payoffText}</Stat>
        <Stat label="Months remaining">
          {t.months_remaining != null ? String(t.months_remaining) : "—"}
        </Stat>
        <Stat label="Interest left">
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
        {t.is_linked ? (
          <p>
            Balance tracked from the linked card account since {t.anchor_date}:
            charges add to it, payments pay it down, starting from your{" "}
            <span className="font-medium text-foreground">
              <Money>{formatCents(t.anchor_balance_cents)}</Money> anchor
            </span>
            .
            {t.recent_monthly_spend_cents > 0 && (
              <>
                {" "}
                You&rsquo;ve been charging about{" "}
                <span className="font-medium text-foreground">
                  <Money>{formatCents(t.recent_monthly_spend_cents)}</Money>/mo
                </span>{" "}
                lately.
              </>
            )}{" "}
            Re-anchor from a fresh statement anytime to reset.
          </p>
        ) : (
          <p>
            This projects the payoff of your{" "}
            <span className="font-medium text-foreground">
              <Money>{formatCents(t.anchor_balance_cents)}</Money> anchor balance
            </span>{" "}
            from {t.anchor_date}. New purchases aren&rsquo;t tracked (no linked
            account) — link the card or re-anchor from a fresh statement to keep it
            accurate.
            {t.min_payment_percent != null && (
              <>
                {" "}
                Your minimum (<Money>{formatCents(t.min_payment_cents)}</Money>) is
                about {t.min_payment_percent}% of the current balance.
              </>
            )}
          </p>
        )}
      </div>

      {/* Projection assumption (linked cards only — needs spend data) */}
      {t.is_linked && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold">Projection assumes…</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={spendMode === "stop" ? "default" : "outline"}
              onClick={() => setSpendMode("stop")}
            >
              I stop charging
            </Button>
            <Button
              type="button"
              size="sm"
              variant={spendMode === "keep" ? "default" : "outline"}
              onClick={() => setSpendMode("keep")}
            >
              I keep spending
            </Button>
            {spendMode === "keep" && (
              <span className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  min="0"
                  step="50"
                  value={keepSpendDollars}
                  onChange={(e) => setKeepSpendDollars(e.target.value)}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">/ mo</span>
              </span>
            )}
          </div>
          {spendMode === "keep" && (
            <p className="mt-2 text-xs text-muted-foreground">
              Projecting continued spend at this rate on top of the plan payment.
              Prefilled from your recent average.
            </p>
          )}
        </div>
      )}

      {/* Trajectory chart */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="mb-4 text-sm font-semibold">Balance over time</p>
        <DebtTrajectoryChart
          trajectory={t}
          scenarioCurve={showScenarioLine ? scenario!.curve : null}
          scenarioLabel={
            scenario ? `${formatCents(scenario.monthly_payment_cents)}/mo` : undefined
          }
          scenarioAhead={scenario ? scenario.monthly_payment_cents > planPayment : true}
        />
        {showScenarioLine && (
          <p className="mt-2 text-xs text-muted-foreground">
            The {scenarioAhead ? "green" : "amber"} line is your{" "}
            <Money>{formatCents(scenario!.monthly_payment_cents)}</Money>/mo
            what-if — adjust the extra payment below to move it.
          </p>
        )}
      </div>

      {/* Scenario explorer */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-semibold">What if I pay extra?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          On top of the <Money>{formatCents(t.min_payment_cents)}</Money> minimum,
          each month
          {spendMode === "keep" && futureSpendCents > 0 && (
            <>
              {" "}
              (and still spending{" "}
              <Money>{formatCents(futureSpendCents)}</Money>/mo)
            </>
          )}
          .
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
                this doesn&rsquo;t outpace interest
                {futureSpendCents > 0 ? " and new spending" : ""} — the balance
                won&rsquo;t pay off.
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
                  className={cn("size-6 rounded-md", getDebtStatusBgColor(m.status))}
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
