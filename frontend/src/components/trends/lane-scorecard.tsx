"use client";

import {
  Home,
  ShoppingBag,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendIndicator, type Trend } from "./trend-indicator";
import { InfoTip } from "./info-tip";
import {
  cn,
  getStatusBgColor,
  getStatusBorderColor,
  formatCents,
} from "@/lib/utils";
import { Money } from "@/components/money";
import type { LaneHistoryMonth, SpendGroup } from "@/types";

const GROUP_ICONS: Record<SpendGroup, typeof Home> = {
  income: TrendingUp,
  necessary: Home,
  discretionary: ShoppingBag,
  anomalous: AlertTriangle,
};

const GROUP_ICON_COLORS: Record<SpendGroup, string> = {
  income: "text-emerald-400",
  necessary: "text-blue-400",
  discretionary: "text-violet-400",
  anomalous: "text-amber-400",
};

interface LaneScorecardProps {
  lane: SpendGroup;
  label: string;
  months: LaneHistoryMonth[];
  selected?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
}

function computeTrend(months: LaneHistoryMonth[]): Trend {
  if (months.length < 2) return "stable";
  const score = (s: string) =>
    s === "on_target" ? 2 : s === "in_tolerance" ? 1 : 0;

  const mid = Math.floor(months.length / 2);
  const older = months.slice(0, mid);
  const recent = months.slice(mid);

  const olderAvg = older.reduce((s, m) => s + score(m.status), 0) / older.length;
  const recentAvg = recent.reduce((s, m) => s + score(m.status), 0) / recent.length;

  if (recentAvg > olderAvg + 0.3) return "improving";
  if (recentAvg < olderAvg - 0.3) return "worsening";
  return "stable";
}

export function LaneScorecard({ lane, label, months, selected, dimmed, onClick }: LaneScorecardProps) {
  const Icon = GROUP_ICONS[lane];

  const onTarget = months.filter((m) => m.status === "on_target").length;
  const inTolerance = months.filter((m) => m.status === "in_tolerance").length;
  const offTarget = months.filter((m) => m.status === "off_target").length;

  const totalDelta = months.reduce(
    (sum, m) => sum + (m.actual_value - m.target_value),
    0
  );
  const avgDelta = months.length > 0 ? Math.round(totalDelta / months.length) : 0;

  const isSpending = lane !== "income";
  const deltaIsGood = isSpending ? avgDelta <= 0 : avgDelta >= 0;
  const deltaColor = avgDelta === 0 ? "text-green-400" : deltaIsGood ? "text-green-400" : "text-red-400";

  const healthScore = months.length > 0
    ? (onTarget * 2 + inTolerance) / (months.length * 2)
    : 1;
  const dominantStatus =
    healthScore >= 0.7 ? "on_target" : healthScore >= 0.4 ? "in_tolerance" : "off_target";

  const trend = computeTrend(months);

  return (
    <Card
      className={cn(
        "border-l-2 cursor-pointer transition-all hover:shadow-md",
        getStatusBorderColor(dominantStatus),
        selected && "ring-2 ring-foreground/20",
        dimmed && "opacity-40"
      )}
      onClick={onClick}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Icon className={cn("size-4", GROUP_ICON_COLORS[lane])} />
          <span className="text-sm font-semibold uppercase tracking-wide text-foreground">
            {label}
          </span>
        </div>

        <div className="flex gap-1">
          {months.map((m) => (
            <div
              key={`${m.year}-${m.month}`}
              className={cn("size-2 shrink-0 rounded-full", getStatusBgColor(m.status))}
              title={`${m.label}: ${m.actual_display} / ${m.target_display}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="text-green-400">{onTarget}</span> on
          {inTolerance > 0 && (
            <>, <span className="text-yellow-400">{inTolerance}</span> tol</>
          )}
          {offTarget > 0 && (
            <>, <span className="text-red-400">{offTarget}</span> off</>
          )}
          <InfoTip text={`Of ${months.length} months: ${onTarget} hit the target, ${inTolerance} were within tolerance, ${offTarget} missed. Each dot above is one month.`} />
        </div>

        <div>
          <div className="flex items-center gap-1.5">
            <p className={cn("text-lg font-bold tabular-nums", deltaColor)}>
              <Money>
                {avgDelta > 0 ? "+" : avgDelta < 0 ? "-" : ""}
                {formatCents(Math.abs(avgDelta))}
              </Money>
            </p>
            <InfoTip
              text={
                isSpending
                  ? `On average, ${label} spending was ${formatCents(Math.abs(avgDelta))}/mo ${avgDelta > 0 ? "over" : "under"} target. ${deltaIsGood ? "Under budget is good." : "Over budget — this lane is consistently exceeding its target."}`
                  : `On average, income was ${formatCents(Math.abs(avgDelta))}/mo ${avgDelta > 0 ? "above" : "below"} target. ${deltaIsGood ? "Above target is good." : "Below target — income is coming in short."}`
              }
            />
          </div>
          <p className="text-[11px] text-muted-foreground">avg monthly delta</p>
        </div>

        <div className="flex items-center gap-1.5">
          <TrendIndicator trend={trend} />
          <InfoTip
            text={
              trend === "improving"
                ? "Recent months are performing better than earlier ones in this period."
                : trend === "worsening"
                  ? "Recent months are performing worse than earlier ones in this period."
                  : "Performance has been consistent across this period."
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
