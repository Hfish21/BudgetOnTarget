"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type Trend = "improving" | "stable" | "worsening";

interface TrendIndicatorProps {
  trend: Trend;
}

const TREND_CONFIG: Record<Trend, { icon: typeof TrendingUp; label: string; color: string }> = {
  improving: { icon: TrendingUp, label: "Improving", color: "text-green-400" },
  stable: { icon: Minus, label: "Stable", color: "text-muted-foreground" },
  worsening: { icon: TrendingDown, label: "Worsening", color: "text-red-400" },
};

export function TrendIndicator({ trend }: TrendIndicatorProps) {
  const { icon: Icon, label, color } = TREND_CONFIG[trend];
  return (
    <div className={cn("flex items-center gap-1 text-xs font-medium", color)}>
      <Icon className="size-3.5" />
      {label}
    </div>
  );
}
