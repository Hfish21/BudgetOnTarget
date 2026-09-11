"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/money";
import { formatCents, getStatusBgColor } from "@/lib/utils";
import type { TargetAssessment } from "@/types";

interface NetSummaryProps {
  /** Actual money-in / money-out (cents) from categorized transactions. */
  summary: { money_in: number; money_out: number };
  /** Budget targets for the period — the "vs target" overlay, may be empty. */
  assessments: TargetAssessment[];
}

export function NetSummary({ summary, assessments }: NetSummaryProps) {
  // Big numbers come from actual categorized transactions.
  const moneyIn = summary.money_in;
  const moneyOut = summary.money_out;

  // Targets are the overlay: derive the "vs target" line + status pills from
  // the target assessments. When a lane has no targets we hide its sub-line
  // rather than show "vs $0.00".
  const { hasIncomeTarget, moneyInTarget, incomeStatus, hasSpendTarget, moneyOutTarget, spendStatus } =
    useMemo(() => {
      let inTarget = 0;
      let inTolLower = 0;
      let inCount = 0;
      let outTarget = 0;
      let outTolUpper = 0;
      let outCount = 0;

      for (const a of assessments) {
        if (a.spend_group === "income") {
          inTarget += a.target_value;
          inTolLower += a.tolerance_lower;
          inCount++;
        } else {
          outTarget += a.target_value;
          outTolUpper += a.tolerance_upper;
          outCount++;
        }
      }

      const incStat = moneyIn >= inTarget ? "on_target"
        : moneyIn >= inTarget - inTolLower ? "in_tolerance" : "off_target";
      const spendStat = moneyOut <= outTarget ? "on_target"
        : moneyOut <= outTarget + outTolUpper ? "in_tolerance" : "off_target";

      return {
        hasIncomeTarget: inCount > 0,
        moneyInTarget: inTarget,
        incomeStatus: incStat,
        hasSpendTarget: outCount > 0,
        moneyOutTarget: outTarget,
        spendStatus: spendStat,
      };
    }, [assessments, moneyIn, moneyOut]);

  const netRemaining = moneyIn - moneyOut;

  return (
    <Card className="border border-border p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        {/* Money In — a label/value row on mobile, a left block on desktop */}
        <div className="order-2 flex items-center justify-between sm:order-none sm:block sm:space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Money In
          </p>
          <div className="flex items-center gap-2 sm:block sm:space-y-1">
            <p className="text-xl font-semibold text-foreground">
              <Money>{formatCents(moneyIn)}</Money>
            </p>
            {hasIncomeTarget ? (
              <div className="flex items-center gap-1.5">
                <div
                  className={`size-2 rounded-full ${getStatusBgColor(incomeStatus)}`}
                />
                <p className="text-xs text-muted-foreground">
                  vs <Money>{formatCents(moneyInTarget)}</Money> target
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/60">no target set</p>
            )}
          </div>
        </div>

        {/* Net Remaining — the hero, first on mobile */}
        <div className="order-1 text-center sm:order-none">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Net Remaining
          </p>
          <p
            className={`text-3xl font-bold tracking-tight ${
              netRemaining > 0
                ? "text-green-400"
                : netRemaining < 0
                  ? "text-red-400"
                  : "text-foreground"
            }`}
          >
            <Money>
              {netRemaining >= 0 ? "+" : ""}
              {formatCents(netRemaining)}
            </Money>
          </p>
          <p className="text-sm text-muted-foreground">left on the table</p>
        </div>

        {/* Money Out — a label/value row on mobile, a right block on desktop */}
        <div className="order-3 flex items-center justify-between sm:order-none sm:block sm:space-y-1 sm:text-right">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Money Out
          </p>
          <div className="flex items-center gap-2 sm:block sm:space-y-1">
            <p className="text-xl font-semibold text-foreground">
              <Money>{formatCents(moneyOut)}</Money>
            </p>
            {hasSpendTarget ? (
              <div className="flex items-center gap-1.5 sm:justify-end">
                <div
                  className={`size-2 rounded-full ${getStatusBgColor(spendStatus)}`}
                />
                <p className="text-xs text-muted-foreground">
                  vs <Money>{formatCents(moneyOutTarget)}</Money> target
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/60 sm:text-right">
                no target set
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
