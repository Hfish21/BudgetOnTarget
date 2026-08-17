"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Money } from "@/components/money";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/debt/info-tip";
import {
  DebtTrajectoryChart,
  type ScenarioTone,
} from "@/components/debt/debt-trajectory-chart";
import {
  formatCents,
  getDebtStatusLabel,
  getDebtStatusBgColor,
  getDebtStatusTextColor,
  cn,
} from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import type { DebtTrajectory, DebtScenario, DebtGoal } from "@/types";

interface DebtDetailProps {
  debtId: number;
  refreshKey: number;
}

function monthIdx(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return y * 12 + (m - 1);
}

function driftPhrase(drift: number | null): string {
  if (drift == null) return "";
  if (drift > 0) return `${drift} month${drift === 1 ? "" : "s"} behind schedule`;
  if (drift < 0) return `${-drift} month${-drift === 1 ? "" : "s"} ahead of schedule`;
  return "right on schedule";
}

export function DebtDetail({ debtId, refreshKey }: DebtDetailProps) {
  const [trajectory, setTrajectory] = useState<DebtTrajectory | null>(null);
  const [scenario, setScenario] = useState<DebtScenario | null>(null);
  const [spendDollars, setSpendDollars] = useState("0");
  const [extraDollars, setExtraDollars] = useState("0");
  const [goalMonths, setGoalMonths] = useState("12");
  const [goal, setGoal] = useState<DebtGoal | null>(null);

  useEffect(() => {
    let alive = true;
    api.debts
      .getTrajectory(debtId, 0)
      .then((t) => {
        if (alive) setTrajectory(t);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [debtId, refreshKey]);

  const configuredExtraCents = trajectory?.extra_payment_cents ?? 0;
  const extraPaymentCents = Math.max(0, Math.round(parseFloat(extraDollars || "0") * 100));
  const spendCents = Math.max(0, Math.round(parseFloat(spendDollars || "0") * 100));

  const runScenario = useCallback(() => {
    api.debts
      .getScenario(debtId, configuredExtraCents + extraPaymentCents, spendCents)
      .then(setScenario)
      .catch(() => {});
  }, [debtId, configuredExtraCents, extraPaymentCents, spendCents]);

  useEffect(() => {
    if (trajectory) runScenario();
  }, [trajectory, runScenario]);

  // Payoff-goal solver.
  const goalN = Math.max(0, Math.round(parseInt(goalMonths || "0", 10)));
  useEffect(() => {
    if (!trajectory || goalN <= 0) {
      setGoal(null);
      return;
    }
    let alive = true;
    api.debts
      .getGoal(debtId, goalN, spendCents)
      .then((g) => {
        if (alive) setGoal(g);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [debtId, refreshKey, goalN, spendCents, trajectory]);

  if (!trajectory || trajectory.debt_id !== debtId) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  const t = trajectory;
  const planPaymentCents = t.min_payment_cents + configuredExtraCents;
  const scenarioPaymentCents = planPaymentCents + extraPaymentCents;
  const isModified = extraPaymentCents > 0 || spendCents > 0;

  const origKey = t.projected_payoff_month_key;
  const scnKey = scenario?.payoff_month_key ?? null;
  const monthsShift = origKey && scnKey ? monthIdx(origKey) - monthIdx(scnKey) : null;
  const scenarioAhead = monthsShift != null ? monthsShift > 0 : extraPaymentCents >= spendCents;
  const scenarioTone: ScenarioTone = scenario?.never_pays_off
    ? "unpayable"
    : scenarioAhead
      ? "ahead"
      : "behind";
  const showScenarioLine = isModified && !!scenario && scenario.curve.length > 1;

  // Break-even spending: above this monthly spend, the current payment can't
  // outrun interest and the balance never clears.
  const r = t.apr_bps / 10000 / 12;
  const maxSpendCents = scenarioPaymentCents - Math.round(t.current_balance_cents * r);

  const headline = t.never_pays_off
    ? "Your monthly payment doesn't cover the interest — this balance won't go down. Increase the payment."
    : t.is_paid_off
      ? "Paid off — nice work."
      : t.projected_payoff_label
        ? `On track to be paid off in ${t.projected_payoff_label}`
        : "Add your payments to see a payoff date";

  // What-if result sentence.
  let scenarioText: React.ReactNode = null;
  if (isModified && scenario) {
    const interestDelta =
      t.total_interest_remaining_cents != null && scenario.total_interest_cents != null
        ? t.total_interest_remaining_cents - scenario.total_interest_cents
        : null;
    if (scenario.never_pays_off) {
      scenarioText = (
        <span className="text-red-600 dark:text-red-400">
          At this rate the balance never gets paid off — what you&rsquo;re spending
          outpaces what you&rsquo;re paying. Spend less or pay more.
        </span>
      );
    } else {
      const phrase =
        monthsShift == null
          ? "pays it off (your current plan wouldn't)"
          : monthsShift > 0
            ? `${monthsShift} month${monthsShift === 1 ? "" : "s"} sooner`
            : monthsShift < 0
              ? `${-monthsShift} month${-monthsShift === 1 ? "" : "s"} later`
              : "about the same timing";
      scenarioText = (
        <span>
          Paid off <span className="font-semibold">{scenario.payoff_label}</span> —{" "}
          <span
            className={cn(
              "font-semibold",
              scenarioAhead
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400"
            )}
          >
            {phrase}
          </span>{" "}
          {monthsShift != null && <>than your current plan ({t.projected_payoff_label}). </>}
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
          <InfoTip>
            <span>
              <b>Ahead / on track / behind</b> compares where your balance actually
              is against where your plan (minimum + your set extra, no new
              spending) said it should be by now.
            </span>
          </InfoTip>
        </div>
        <p className="mt-2 text-lg font-semibold tracking-tight">{headline}</p>
      </div>

      {/* Key stats — your current plan */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Balance today"
          tip="Your estimated balance right now — the anchor balance plus everything charged since, minus your payments, with interest added each month."
        >
          <Money>{formatCents(t.current_balance_cents)}</Money>
        </Stat>
        <Stat
          label="Debt-free by"
          tip="When you'll be paid off if you keep paying your current monthly amount and stop adding new charges."
        >
          {t.never_pays_off ? "Never at this rate" : (t.projected_payoff_label ?? "—")}
        </Stat>
        <Stat
          label="Months to go"
          tip="How many months until the balance hits zero on your current plan."
        >
          {t.months_remaining != null ? String(t.months_remaining) : "—"}
        </Stat>
        <Stat
          label="Interest you'll still pay"
          tip="Total interest left to pay before it's gone, if you stick to your current plan."
        >
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
        <div className="mb-4 flex items-center gap-2">
          <p className="text-sm font-semibold">Balance over time</p>
          <InfoTip>
            Each point is one month. The dashed <b>Current plan</b> line is where
            you&rsquo;re headed now; the solid line is your <b>what-if</b> below.
            The vertical markers call out the exact payoff month.
          </InfoTip>
        </div>
        <DebtTrajectoryChart
          trajectory={t}
          scenarioCurve={showScenarioLine ? scenario!.curve : null}
          scenarioLabel="Your what-if"
          scenarioTone={scenarioTone}
          planPayoffLabel={t.never_pays_off ? null : t.projected_payoff_label}
          scenarioPayoffLabel={
            showScenarioLine && scenario && !scenario.never_pays_off
              ? scenario.payoff_label
              : null
          }
        />
      </div>

      {/* Unified projection: two levers -> one net what-if line */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">Play with the numbers</p>
          <InfoTip>
            Spending more pushes your payoff date out; paying more brings it in.
            The line on the chart is the net of the two, compared to your current
            plan of <Money>{formatCents(planPaymentCents)}</Money>/mo.
          </InfoTip>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              If I keep spending&hellip;
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
            <p className="mt-1.5 text-xs text-muted-foreground">
              {maxSpendCents > 0 ? (
                <>
                  Spend more than about{" "}
                  <span className="font-medium text-red-600 dark:text-red-400">
                    <Money>{formatCents(maxSpendCents)}</Money>/mo
                  </span>{" "}
                  and it never gets paid off.
                </>
              ) : (
                <span className="font-medium text-red-600 dark:text-red-400">
                  Your payment doesn&rsquo;t cover interest yet — even $0 new
                  spending won&rsquo;t pay this off.
                </span>
              )}
            </p>
            {t.is_linked && t.recent_monthly_spend_cents > 0 && (
              <button
                type="button"
                onClick={() =>
                  setSpendDollars((t.recent_monthly_spend_cents / 100).toFixed(0))
                }
                className="mt-1 text-xs text-primary hover:underline"
              >
                Use my recent average ({formatCents(t.recent_monthly_spend_cents)}/mo)
              </button>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              If I pay extra&hellip;
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
            Leave both at $0 to see just your current plan. Change either to see the
            what-if line appear on the chart above.
          </p>
        )}
      </div>

      {/* Payoff goal solver */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">Hit a payoff goal</p>
          <InfoTip>
            Pick how soon you want to be debt-free and we&rsquo;ll tell you the
            monthly payment it takes{spendCents > 0 ? " (given your spending above)" : ""}.
          </InfoTip>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Pay it off in</span>
          <Input
            type="number"
            min="1"
            step="1"
            value={goalMonths}
            onChange={(e) => setGoalMonths(e.target.value)}
            className="w-20"
          />
          <span className="text-muted-foreground">months</span>
        </div>

        {goal && goalN > 0 && (
          <div className="mt-4 rounded-lg bg-muted/40 p-4 text-sm">
            {goal.is_paid_off ? (
              <span>This card is already paid off.</span>
            ) : goal.already_on_track ? (
              <span>
                You&rsquo;re already on track — your current plan pays this off by{" "}
                <span className="font-semibold">{t.projected_payoff_label}</span>,
                within {goalN} months. You could even pay{" "}
                <span className="font-semibold">
                  <Money>{formatCents(Math.abs(goal.extra_over_plan_cents))}</Money>
                </span>
                /mo less.
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>
                  Pay{" "}
                  <span className="font-semibold">
                    <Money>{formatCents(goal.monthly_payment_cents)}</Money>/mo
                  </span>{" "}
                  (that&rsquo;s{" "}
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    <Money>{formatCents(goal.extra_over_plan_cents)}</Money>/mo extra
                  </span>
                  ) to be done by{" "}
                  <span className="font-semibold">{goal.payoff_label}</span>.
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setExtraDollars((goal.extra_over_plan_cents / 100).toFixed(0))
                  }
                >
                  Show this on the chart
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  tip,
  children,
}: {
  label: string;
  tip?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {tip && <InfoTip>{tip}</InfoTip>}
      </p>
      <p className="mt-1 text-lg font-semibold tracking-tight">{children}</p>
    </div>
  );
}
