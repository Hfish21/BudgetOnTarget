"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getStatusBgColor,
  getStatusLabel,
  getDirectionLabel,
  formatCents,
  cn,
} from "@/lib/utils";
import { Money } from "@/components/money";
import { ArrowDown, ArrowUp, Equal } from "lucide-react";
import type { TargetAssessment } from "@/types";

interface TargetCardProps {
  assessment: TargetAssessment;
  onClick?: () => void;
}

function DirectionIcon({ direction }: { direction: string }) {
  switch (direction) {
    case "at_most":
      return <ArrowDown className="size-3.5 text-muted-foreground" />;
    case "at_least":
      return <ArrowUp className="size-3.5 text-muted-foreground" />;
    case "exactly":
      return <Equal className="size-3.5 text-muted-foreground" />;
    default:
      return null;
  }
}

export function TargetCard({ assessment, onClick }: TargetCardProps) {
  const {
    target_name,
    actual_display,
    target_display,
    status,
    percent_of_target,
    direction,
    actual_value,
    target_value,
    history,
  } = assessment;

  const delta = actual_value - target_value;
  const isSpending = direction === "at_most";
  const deltaIsGood = isSpending ? delta <= 0 : delta >= 0;
  const deltaColor = delta === 0 ? "text-green-400" : deltaIsGood ? "text-green-400" : "text-red-400";
  const barMax = Math.max(Math.min(percent_of_target, 150), 100);
  const fillPct = (percent_of_target / barMax) * 100;
  const targetLinePct = (100 / barMax) * 100;

  return (
    <Card
      className={cn("cursor-pointer transition-shadow hover:shadow-md", {
        "ring-2 ring-green-500/20": status === "on_target",
        "ring-2 ring-yellow-500/20": status === "in_tolerance",
        "ring-2 ring-red-500/20": status === "off_target",
      })}
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">{target_name}</CardTitle>
          <div
            className={cn(
              "size-2.5 rounded-full",
              getStatusBgColor(status)
            )}
            title={getStatusLabel(status)}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="text-2xl font-bold tracking-tight">
            <Money>{actual_display}</Money>{" "}
            <span className="text-sm font-normal text-muted-foreground">
              / <Money>{target_display}</Money>
            </span>
          </p>
          {delta !== 0 && (
            <span className={cn("text-sm font-semibold tabular-nums", deltaColor)}>
              <Money>{delta > 0 ? "+" : "-"}{formatCents(Math.abs(delta))}</Money>
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <DirectionIcon direction={direction} />
            {getDirectionLabel(direction)}
          </span>
          <span>{percent_of_target.toFixed(1)}%</span>
        </div>

        <div className="relative h-2 w-full rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              getStatusBgColor(status)
            )}
            style={{ width: `${fillPct}%` }}
          />
          {percent_of_target > 0 && (
            <div
              className="absolute top-[-1px] h-[calc(100%+2px)] w-0.5 rounded-full bg-foreground/60"
              style={{ left: `${targetLinePct}%` }}
            />
          )}
        </div>

        {/* History dots */}
        {history.length > 0 && (
          <div className="flex items-center gap-1 pt-1">
            <span className="mr-1 text-[10px] text-muted-foreground">
              History:
            </span>
            <div className="flex gap-1 overflow-x-auto">
              {history.map((h) => (
                <div
                  key={`${h.year}-${h.month}`}
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    getStatusBgColor(h.status)
                  )}
                  title={`${h.year}-${String(h.month).padStart(2, "0")}: ${getStatusLabel(h.status)}`}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
