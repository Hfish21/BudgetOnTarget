"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { api } from "@/lib/api";
import { formatCents } from "@/lib/utils";
import { usePrivacy } from "@/components/privacy-provider";
import { PrivateYAxisTick } from "@/components/charts/private-axis-tick";
import type { LaneHistoryMonth, SpendGroup } from "@/types";

interface LaneHistoryDialogProps {
  spendGroup: SpendGroup | null;
  groupName: string;
  year: number;
  month: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_COLORS: Record<string, string> = {
  on_target: "oklch(0.65 0.19 145)",
  in_tolerance: "oklch(0.75 0.15 85)",
  off_target: "oklch(0.65 0.22 25)",
};

export function LaneHistoryDialog({
  spendGroup,
  groupName,
  year,
  month,
  open,
  onOpenChange,
}: LaneHistoryDialogProps) {
  const { privacyMode } = usePrivacy();
  const [history, setHistory] = useState<LaneHistoryMonth[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !spendGroup) return;
    setLoading(true);
    api.dashboard
      .getLaneHistory(spendGroup)
      .then((data) => setHistory(data.months))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [open, spendGroup]);

  useEffect(() => {
    if (!open) setHistory([]);
  }, [open]);

  const chartData = useMemo(
    () =>
      history.map((m) => ({
        label: m.label,
        actual: m.actual_value / 100,
        target: m.target_value / 100,
        status: m.status,
        actualDisplay: m.actual_display,
        targetDisplay: m.target_display,
        isCurrent: m.year === year && m.month === month,
      })),
    [history, year, month]
  );

  const targetLine =
    chartData.length > 0 ? chartData[chartData.length - 1].target : 0;

  if (!spendGroup) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{groupName} — Monthly History</DialogTitle>
          <DialogDescription>
            Aggregate lane spend vs target over time
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-auto -mx-4 px-4 flex-1">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-48 w-full animate-pulse rounded bg-muted" />
            </div>
          ) : chartData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No history available.
            </p>
          ) : (
            <div className="py-4">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="oklch(0.25 0 0)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    tick={{ fill: "oklch(0.65 0 0)" }}
                    interval={
                      chartData.length > 12
                        ? Math.floor(chartData.length / 8)
                        : 0
                    }
                    angle={chartData.length > 6 ? -45 : 0}
                    textAnchor={chartData.length > 6 ? "end" : "middle"}
                    height={chartData.length > 6 ? 60 : 30}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={<PrivateYAxisTick formatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`} />}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload;
                      const blur = privacyMode ? { filter: "blur(8px)", userSelect: "none" as const } : undefined;
                      return (
                        <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
                          <p className="mb-1 text-xs font-medium text-foreground">
                            {d.label}
                          </p>
                          <p
                            className="text-sm"
                            style={{ color: STATUS_COLORS[d.status] }}
                          >
                            Actual: <span style={blur}>{d.actualDisplay}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Target: <span style={blur}>{d.targetDisplay}</span>
                          </p>
                        </div>
                      );
                    }}
                  />
                  {targetLine > 0 && (
                    <ReferenceLine
                      y={targetLine}
                      stroke={privacyMode ? "transparent" : "oklch(0.65 0 0)"}
                      strokeDasharray="6 4"
                      strokeWidth={1.5}
                      label={privacyMode ? undefined : {
                        value: `Target: ${formatCents(Math.round(targetLine * 100))}`,
                        position: "insideTopRight",
                        fill: "oklch(0.65 0 0)",
                        fontSize: 11,
                      }}
                    />
                  )}
                  <Bar dataKey="actual" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={STATUS_COLORS[entry.status]}
                        opacity={entry.isCurrent ? 1 : 0.7}
                        stroke={
                          entry.isCurrent ? "oklch(0.9 0 0)" : "none"
                        }
                        strokeWidth={entry.isCurrent ? 2 : 0}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
