"use client";

import { useState, useEffect } from "react";
import {
  Home,
  ShoppingBag,
  AlertTriangle,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import { TargetCard } from "./target-card";
import {
  cn,
  getStatusBgColor,
  getStatusBorderColor,
  formatCents,
} from "@/lib/utils";
import type { TargetAssessment, SpendGroup } from "@/types";

interface GroupSectionProps {
  groupName: string;
  groupKey: SpendGroup;
  assessments: TargetAssessment[];
  defaultExpanded?: boolean;
  onCardClick?: (targetId: number) => void;
}

const GROUP_ICONS: Record<SpendGroup, typeof Home> = {
  income: TrendingUp,
  necessary: Home,
  discretionary: ShoppingBag,
  anomalous: AlertTriangle,
};

function useLocalStorage(key: string, defaultValue: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const stored = localStorage.getItem(key);
    if (stored !== null) setValue(stored === "true");
  }, [key]);

  const setAndStore = (v: boolean) => {
    setValue(v);
    localStorage.setItem(key, String(v));
  };

  return [value, setAndStore];
}

export function GroupSection({
  groupName,
  groupKey,
  assessments,
  defaultExpanded = true,
  onCardClick,
}: GroupSectionProps) {
  const [expanded, setExpanded] = useLocalStorage(
    `ledgerline-group-${groupKey}`,
    defaultExpanded
  );

  const Icon = GROUP_ICONS[groupKey];

  const totalActual = assessments.reduce((sum, a) => sum + a.actual_value, 0);
  const totalTarget = assessments.reduce((sum, a) => sum + a.target_value, 0);
  const totalToleranceUpper = assessments.reduce((sum, a) => sum + a.tolerance_upper, 0);
  const totalToleranceLower = assessments.reduce((sum, a) => sum + a.tolerance_lower, 0);
  const pct = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 1000) / 10 : (totalActual > 0 ? 100 : 0);

  const groupStatus = (() => {
    const isSpendingGroup = groupKey !== "income";
    if (isSpendingGroup) {
      if (totalActual <= totalTarget) return "on_target" as const;
      if (totalActual <= totalTarget + totalToleranceUpper) return "in_tolerance" as const;
      return "off_target" as const;
    } else {
      if (totalActual >= totalTarget) return "on_target" as const;
      if (totalActual >= totalTarget - totalToleranceLower) return "in_tolerance" as const;
      return "off_target" as const;
    }
  })();

  const onTargetCount = assessments.filter((a) => a.status === "on_target").length;
  const inToleranceCount = assessments.filter((a) => a.status === "in_tolerance").length;
  const offTargetCount = assessments.filter((a) => a.status === "off_target").length;

  const delta = totalActual - totalTarget;
  const isSpending = groupKey !== "income";
  const deltaIsGood = isSpending ? delta <= 0 : delta >= 0;
  const deltaColor = deltaIsGood ? "text-green-400" : delta === 0 ? "text-green-400" : "text-red-400";
  const deltaLabel = isSpending
    ? (delta > 0 ? "over" : "under")
    : (delta > 0 ? "above" : "below");

  const statusColor =
    groupStatus === "on_target"
      ? "text-green-400"
      : groupStatus === "in_tolerance"
        ? "text-yellow-400"
        : "text-red-400";

  const barMax = Math.max(Math.min(pct, 150), 100);
  const fillPct = (pct / barMax) * 100;
  const targetLinePct = (100 / barMax) * 100;

  return (
    <div
      className={cn(
        "border-l-2 pl-4",
        getStatusBorderColor(groupStatus),
        groupKey === "income" && "bg-green-500/5 rounded-r-lg pr-4 py-2"
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between border-b border-border pb-3 transition-colors hover:bg-accent/30 rounded px-2 py-1.5 cursor-pointer"
        aria-expanded={expanded}
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Icon className={cn("size-4", statusColor)} />
            <span className="text-base font-semibold uppercase tracking-wide text-foreground">
              {groupName}
            </span>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform duration-200",
                !expanded && "-rotate-90"
              )}
            />
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span>
              <span className="font-medium text-foreground">
                {formatCents(totalActual)}
              </span>
              <span className="text-muted-foreground">
                {" "}/ {formatCents(totalTarget)}
              </span>
            </span>
            <span className="text-muted-foreground">
              <span className="text-green-400">{onTargetCount}</span> on
              {inToleranceCount > 0 && (
                <>, <span className="text-yellow-400">{inToleranceCount}</span> close</>
              )}
              {offTargetCount > 0 && (
                <>, <span className="text-red-400">{offTargetCount}</span> off</>
              )}
            </span>
          </div>
          <div className="relative h-2 w-40 rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                getStatusBgColor(groupStatus)
              )}
              style={{ width: `${fillPct}%` }}
            />
            {pct > 0 && (
              <div
                className="absolute top-[-1px] h-[calc(100%+2px)] w-0.5 rounded-full bg-foreground/60"
                style={{ left: `${targetLinePct}%` }}
              />
            )}
          </div>
        </div>

        <div className="text-right">
          {delta !== 0 ? (
            <>
              <p className={cn("text-xl font-bold tabular-nums", deltaColor)}>
                {formatCents(Math.abs(delta))}
              </p>
              <p className="text-xs text-muted-foreground">{deltaLabel}</p>
            </>
          ) : (
            <p className="text-lg font-semibold text-green-400">On Target</p>
          )}
        </div>
      </button>

      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          expanded ? "mt-4 max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assessments.map((assessment) => (
            <TargetCard
              key={assessment.target_id}
              assessment={assessment}
              onClick={() => onCardClick?.(assessment.target_id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
