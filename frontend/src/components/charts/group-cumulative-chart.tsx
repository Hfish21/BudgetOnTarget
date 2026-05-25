"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fillCumulativeData,
  GROUP_COLORS,
  GROUP_ORDER,
  getGroupLabel,
  formatCents,
  cn,
} from "@/lib/utils";
import { CumulativeProgressChart } from "./cumulative-progress-chart";
import type { CumulativeTarget } from "@/types";

interface GroupCumulativeChartProps {
  targets: CumulativeTarget[];
  year: number;
  month: number;
  highlightedTargetId?: number | null;
}

export function GroupCumulativeChart({
  targets,
  year,
  month,
  highlightedTargetId,
}: GroupCumulativeChartProps) {
  const [view, setView] = useState<"group" | "target">("group");
  const [visibleGroups, setVisibleGroups] = useState<Set<string>>(
    new Set(GROUP_ORDER)
  );

  const { chartData, groupTotals } = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const data: Record<string, number | string>[] = [];
    const totals: Record<string, number> = {};

    const grouped: Record<string, CumulativeTarget[]> = {};
    for (const t of targets) {
      const g = t.spend_group;
      if (g === "income") continue;
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push(t);
      totals[g] = (totals[g] || 0) + t.target_value;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const entry: Record<string, number | string> = { date: dateStr, day };

      for (const [group, groupTargets] of Object.entries(grouped)) {
        let sum = 0;
        for (const t of groupTargets) {
          const filled = fillCumulativeData(t.data_points, year, month);
          const point = filled.find((p) => p.date === dateStr);
          sum += point ? point.cumulative_value : 0;
        }
        entry[group] = sum / 100;
      }

      data.push(entry);
    }

    return { chartData: data, groupTotals: totals };
  }, [targets, year, month]);

  const activeGroups = GROUP_ORDER.filter(
    (g) => g !== "income" && groupTotals[g] !== undefined
  );

  const toggleGroup = (group: string) => {
    setVisibleGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  if (targets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spending Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            No data available for this period.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Spending Trends</CardTitle>
          <div className="flex rounded-lg bg-muted p-0.5">
            <button
              onClick={() => setView("group")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-all",
                view === "group"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              By Group
            </button>
            <button
              onClick={() => setView("target")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-all",
                view === "target"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              By Target
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {view === "target" ? (
          <CumulativeProgressChart
            targets={targets}
            year={year}
            month={month}
            highlightedTargetId={highlightedTargetId}
            embedded
          />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {activeGroups.map((group) => {
                const color = GROUP_COLORS[group];
                const isVisible = visibleGroups.has(group);
                return (
                  <button
                    key={group}
                    onClick={() => toggleGroup(group)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                      isVisible
                        ? "border-transparent bg-accent text-foreground"
                        : "border-border bg-card text-muted-foreground"
                    )}
                  >
                    <span
                      className="inline-block size-2.5 rounded-full"
                      style={{
                        backgroundColor: isVisible
                          ? color
                          : "oklch(0.45 0 0)",
                      }}
                    />
                    {getGroupLabel(group)}
                  </button>
                );
              })}
            </div>

            <ResponsiveContainer width="100%" height={350}>
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="oklch(0.25 0 0)"
                />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  tick={{ fill: "oklch(0.65 0 0)" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  tick={{ fill: "oklch(0.65 0 0)" }}
                  tickFormatter={(value: number) => `$${value.toLocaleString()}`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload) return null;
                    return (
                      <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
                        <p className="mb-1 text-xs text-muted-foreground">
                          Day {label}
                        </p>
                        {payload.map((entry) => {
                          const group = String(entry.dataKey);
                          const target = groupTotals[group] || 0;
                          const val = (entry.value as number) * 100;
                          const pct =
                            target > 0
                              ? Math.round((val / target) * 100)
                              : 0;
                          return (
                            <p
                              key={group}
                              className="text-sm font-medium"
                              style={{ color: entry.color }}
                            >
                              {getGroupLabel(group)}:{" "}
                              {formatCents(Math.round(val))} ({pct}%)
                            </p>
                          );
                        })}
                      </div>
                    );
                  }}
                />

                {activeGroups.map((group) => {
                  if (!visibleGroups.has(group)) return null;
                  const target = groupTotals[group] || 0;
                  return (
                    <ReferenceLine
                      key={`ref-${group}`}
                      y={target / 100}
                      stroke="oklch(0.50 0 0)"
                      strokeDasharray="8 4"
                      strokeWidth={1}
                      label={{
                        value: `${getGroupLabel(group)} $${(target / 100).toLocaleString()}`,
                        position: "right",
                        fill: "oklch(0.50 0 0)",
                        fontSize: 11,
                      }}
                    />
                  );
                })}

                {activeGroups.map((group) => {
                  if (!visibleGroups.has(group)) return null;
                  return (
                    <Line
                      key={`line-${group}`}
                      type="monotone"
                      dataKey={group}
                      stroke={GROUP_COLORS[group]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}
