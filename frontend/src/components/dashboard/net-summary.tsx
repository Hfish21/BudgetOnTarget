"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { formatCents, getStatusBgColor, deriveGroupStatus } from "@/lib/utils";
import type { TargetAssessment } from "@/types";

interface NetSummaryProps {
  assessments: TargetAssessment[];
}

export function NetSummary({ assessments }: NetSummaryProps) {
  const { moneyIn, moneyInTarget, moneyOut, moneyOutTarget, incomeStatus, spendStatus } =
    useMemo(() => {
      let inVal = 0;
      let inTarget = 0;
      let outVal = 0;
      let outTarget = 0;
      const incomeStatuses: string[] = [];
      const spendStatuses: string[] = [];

      for (const a of assessments) {
        if (a.spend_group === "income") {
          inVal += a.actual_value;
          inTarget += a.target_value;
          incomeStatuses.push(a.status);
        } else {
          outVal += a.actual_value;
          outTarget += a.target_value;
          spendStatuses.push(a.status);
        }
      }

      return {
        moneyIn: inVal,
        moneyInTarget: inTarget,
        moneyOut: outVal,
        moneyOutTarget: outTarget,
        incomeStatus: deriveGroupStatus(incomeStatuses),
        spendStatus: deriveGroupStatus(spendStatuses),
      };
    }, [assessments]);

  const netRemaining = moneyIn - moneyOut;

  return (
    <Card className="border border-border p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Money In
          </p>
          <p className="text-xl font-semibold text-foreground">
            {formatCents(moneyIn)}
          </p>
          <div className="flex items-center gap-1.5">
            <div
              className={`size-2 rounded-full ${getStatusBgColor(incomeStatus)}`}
            />
            <p className="text-xs text-muted-foreground">
              vs {formatCents(moneyInTarget)} target
            </p>
          </div>
        </div>

        <div className="text-center">
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
            {netRemaining >= 0 ? "+" : ""}
            {formatCents(netRemaining)}
          </p>
          <p className="text-sm text-muted-foreground">left on the table</p>
        </div>

        <div className="space-y-1 text-right">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Money Out
          </p>
          <p className="text-xl font-semibold text-foreground">
            {formatCents(moneyOut)}
          </p>
          <div className="flex items-center justify-end gap-1.5">
            <div
              className={`size-2 rounded-full ${getStatusBgColor(spendStatus)}`}
            />
            <p className="text-xs text-muted-foreground">
              vs {formatCents(moneyOutTarget)} target
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
