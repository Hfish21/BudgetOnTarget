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

/** Month index for "YYYY-MM", for comparing payoff dates. */
function monthIdx(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return y * 12 + (m - 1);
}

function driftPhrase(drift: number | null): string {
  if (drift == null) return "";
  if (drift > 0) return `${drift} month${drift === 1 ? "" : "s"} later than plan`;
  if (drift < 0) return `${-drift} month${-drift === 1 ? "" : "s"} ahead of plan`;
  return "right on plan";
}

export function DebtDetail({ debtId, refreshKey }: DebtDetailProps) {
  // The base trajectory is your CURRENT PLAN (no new spending) — the "original".
  // It only depends on the card, so the sliders never refetch it.
  const [trajectory, setTrajectory] = useState<DebtTrajectory | null>(null);
  // The combined what-if (future spending + extra payment) drives the scenario line.
  const [scenario, setScenario] = useState<DebtScenario | null>(null);
  const [spendDollars, setSpendDollars] = useState("0"); // extra monthly spending
  const [extraDollars, setExtraDollars] = useState("0"); // extra monthly payment

  useEffect(() => {
    let alive = true;
    api.debts
      .getTrajectory(debtId, 0)
      .then((t) => {
        if (alive) setTrajectory(t);
      })
      .catch(() => {
        /* non-critical */
      });
    return () => {
      alive = false;
    };
  }, [debtId, refreshKey]);

  const configuredExtraCents = trajectory?.extra_payment_cents ?? 0;
  const extraPaymentCents = Math.max(0, Math.round(parseFloat(extraDollars || "0") * 100));
  const spendCents = Math.max(0, Math.round(parseFloat(spendDollars || "0") * 100));

  // Scenario payment = your plan (min + configured extra) + the extra you add here.
  const runScenario = useCallback(() => {
    api.debts
      .getScenario(debtId, configuredExtraCents + extraPaymentCents, spendCents)
      .then(setScenario)
      .catch(() => {
        /* non-critical */
      });
  }, [debtId, configuredExtraCents, extraPaymentCents, spendCents]);

  useEffect(() => {
    if (trajectory) runScenario();
  }, [trajectory, runScenario]);

  // Skeleton only before the first load or while switching to another card —
  // never on an in-place refetch, so the inputs keep focus.
  if (!trajectory || trajectory.debt_id !== debtId) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  const t = trajectory;
  const planPaymentCents = t.min_payment_cents + configuredExtraCents;
  const isModified = extraPaymentCents > 0 || spendCents > 0;

  const origKey = t.projected_payoff_month_key;
  const scnKey = scenario?.payoff_month_key ?? null;
  const monthsShift =
    origKey && scnKey ? monthIdx(origKey) - monthIdx(scnKey) : null; // + => sooner
  const scenarioAhead = monthsShift != null ? monthsShift > 0 : extraPaymentCents >= spendCents;
  const showScenarioLine =
    isModified && !!scenario && !scenario.never_pays_off && scenario.curve.length > 1;

  const headline = t.never_pays_off
    ? "The minimum payment doesn't cover the monthly interest — this balance won't pay off. Increase the payment."
    : t.is_paid_off
      ? "Paid off — nice work."
      : t.projected_payoff_label
        ? `Projected payoff ${t.projected_payoff_label}`
        : "Projected payoff — enter your payments to see it";

  // Plain-English result of the what-if.
  let scenarioText: React.ReactNode = null;
  if (isModified && scenario) {
    const origInt = t.total_interest_remaining_cents;
    const scnInt = scenario.total_interest_cents;
    const interestDelta = origInt != null && scnInt != null ? origInt - scnInt : null;
    if (scenario.never_pays_off) {
      scenarioText = (
        <span className="text-red-600 dark:text-red-400">
          At {spendCents > 0 && <><Money>{formatCents(spendCents)}</Money>/mo spending</>}
          {spendCents > 0 && extraPaymentCents > 0 ? " and " : ""}
          {extraPaymentCents > 0 && <><Money>{formatCents(extraPaymentCents)}</Money>/mo extra</>}
          , this never gets paid off — spending outpaces the payment.
        </span>
      );
    } else {
      const shiftPhrase =
        monthsShift == null
          ? "your current plan wouldn't pay it off"
          : monthsShift > 0
            ? `${monthsShift} month${monthsShift === 1 ? "" : "s"} sooner`
            : monthsShift < 0
              ? `${-monthsShift} month${-monthsShift === 1 ? "" : "s"} later`
              : "the same timing";
      scenarioText = (
        <span>
          Paid off <span className="font-semibold">{scenario.payoff_label}</span>
          {" — "}
          <span
            className={cn(
              "font-semibold",
              scenarioAhead
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400"
            )}
          >
            {shiftPhrase}
          </span>{" "}
          {monthsShift != null && (
            <>than your current plan ({t.projected_payoff_label}). </>
          )}
          {interestDelta != null && interestDelta !== 0 && (
            <>
              {interestDelta > 0 ? "Saves " : "Costs "}
              <span
                className={cn(
                  "font-semibold",
                  interestDelta > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                )}
              >
                <Money>{formatCents(Math.abs(interestDelta))}</Money>
              </span>{" "}
              {interestDelta > 0 ? "in interest." : "more in interest."}
            </>
          )}
        </span>
      );
    }
  }

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

      {/* Key stats — your current plan */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Estimated balance now">
          <Money>{formatCents(t.current_balance_cents)}</Money>
        </Stat>
        <Stat label="Projected payoff (current plan)">
          {t.never_pays_off ? "Never at this rate" : (t.projected_payoff_label ?? "—")}
        </Stat>
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
          </p>
        )}
      </div>

      {/* Trajectory chart */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="mb-4 text-sm font-semibold">Balance over time</p>
        <DebtTrajectoryChart
          trajectory={t}
          scenarioCurve={showScenarioLine ? scenario!.curve : null}
          scenarioLabel="Your what-if"
          scenarioAhead={scenarioAhead}
        />
      </div>

      {/* Unified projection panel: two levers -> one combined line */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-semibold">Project your payoff</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Adjust either lever. Spending more pushes the payoff out; paying more
          brings it in — the line on the chart is the net of the two, compared to
          your current plan (paying{" "}
          <Money>{formatCents(planPaymentCents)}</Money>/mo).
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Extra monthly spending
            </label>
            <div className="mt-1 flex items-center gap-1">
              <span className="text-sm text-muted-foreground">$</span>
              <Input
                type="number"
                min="0"
                step="50"
                value={spendDollars}
                onChange={(e) => setSpendDollars(e.target.value)}
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">/ mo</span>
            </div>
            {t.is_linked && t.recent_monthly_spend_cents > 0 && (
              <button
                type="button"
                onClick={() =>
                  setSpendDollars((t.recent_monthly_spend_cents / 100).toFixed(0))
                }
                className="mt-1.5 text-xs text-primary hover:underline"
              >
                Use my recent average (
                {formatCents(t.recent_monthly_spend_cents)}/mo)
              </button>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Extra monthly payment
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
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
                <span className="text-sm text-muted-foreground">/ mo</span>
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
          </div>
        </div>

        {isModified && scenarioText && (
          <div className="mt-4 rounded-lg bg-muted/40 p-4 text-sm">{scenarioText}</div>
        )}
        {!isModified && (
          <p className="mt-4 text-xs text-muted-foreground">
            Both at $0 shows just your current plan. Bump either to see the
            what-if line appear.
          </p>
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
