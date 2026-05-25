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
import { usePrivacy } from "@/components/privacy-provider";
import { PrivateYAxisTick } from "@/components/charts/private-axis-tick";
import { CumulativeProgressChart } from "./cumulative-progress-chart";
import type { CumulativeTarget } from "@/types";

interface GroupCumulativeChartProps {
  targets: CumulativeTarget[];
  year: number;
  month: number;
  highlightedTargetId?: number | null;
}

const yAxisFormatter = (value: number) => `$${value.toLocaleString()}`;

export function GroupCumulativeChart({
  targets,
  year,
  month,
  highlightedTargetId,
}: GroupCumulativeChartProps) {
  const [view, setView] = useState<"group" | "target">("group");
  const { privacyMode } = usePrivacy();
  const [visibleGroups, setVisibleGroups] = useState<Set<string>>(
    new Set([...GROUP_ORDER, "total_in", "total_out"])
  );

  const { chartData, groupTotals, hasIncome } = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const data: Record<string, number | string>[] = [];
    const totals: Record<string, number> = {};

    const grouped: Record<string, CumulativeTarget[]> = {};
    const incomeTargets: CumulativeTarget[] = [];
    let incomeTotal = 0;

    for (const t of targets) {
      const g = t.spend_group;
      if (g === "income") {
        incomeTargets.push(t);
        incomeTotal += t.target_value;
        continue;
      }
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push(t);
      totals[g] = (totals[g] || 0) + t.target_value;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const entry: Record<string, number | string> = { date: dateStr, day };

      let totalOut = 0;
      for (const [group, groupTargets] of Object.entries(grouped)) {
        let sum = 0;
        for (const t of groupTargets) {
          const filled = fillCumulativeData(t.data_points, year, month);
          const point = filled.find((p) => p.date === dateStr);
          sum += point ? point.cumulative_value : 0;
        }
        entry[group] = sum / 100;
        totalOut += sum;
      }
      entry["total_out"] = totalOut / 100;

      let totalIn = 0;
      for (const t of incomeTargets) {
        const filled = fillCumulativeData(t.data_points, year, month);
        const point = filled.find((p) => p.date === dateStr);
        totalIn += point ? point.cumulative_value : 0;
      }
      entry["total_in"] = totalIn / 100;

      data.push(entry);
    }

    if (incomeTotal > 0) totals["total_in"] = incomeTotal;

    return { chartData: data, groupTotals: totals, hasIncome: incomeTargets.length > 0 };
  }, [targets, year, month]);

  const activeGroups = GROUP_ORDER.filter(
    (g) => g !== "income" && groupTotals[g] !== undefined
  );

  const allKeys = [...(hasIncome ? ["total_in"] : []), "total_out", ...activeGroups];
  const allVisible = allKeys.every((k) => visibleGroups.has(k));

  const toggleAll = () => {
    setVisibleGroups(allVisible ? new Set() : new Set(allKeys));
  };

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
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button
                onClick={toggleAll}
                className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-all hover:text-foreground"
              >
                {allVisible ? "Hide All" : "Show All"}
              </button>
              <div className="mx-0.5 h-4 w-px bg-border" />
              {hasIncome && (
                <button
                  onClick={() => toggleGroup("total_in")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                    visibleGroups.has("total_in")
                      ? "border-transparent bg-accent text-foreground"
                      : "border-border bg-card text-muted-foreground"
                  )}
                >
                  <span
                    className="inline-block size-2.5 rounded-full"
                    style={{ backgroundColor: visibleGroups.has("total_in") ? "#22c55e" : "oklch(0.45 0 0)" }}
                  />
                  Money In
                </button>
              )}
              <button
                onClick={() => toggleGroup("total_out")}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                  visibleGroups.has("total_out")
                    ? "border-transparent bg-accent text-foreground"
                    : "border-border bg-card text-muted-foreground"
                )}
              >
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ backgroundColor: visibleGroups.has("total_out") ? "#ef4444" : "oklch(0.45 0 0)" }}
                />
                Total Out
              </button>
              <div className="mx-1 w-px bg-border" />
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
                  tick={<PrivateYAxisTick formatter={yAxisFormatter} />}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload) return null;
                    const blur = privacyMode ? { filter: "blur(8px)", userSelect: "none" as const } : undefined;
                    return (
                      <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
                        <p className="mb-1 text-xs text-muted-foreground">
                          Day {label}
                        </p>
                        {payload.map((entry) => {
                          const key = String(entry.dataKey);
                          const target = groupTotals[key] || 0;
                          const val = (entry.value as number) * 100;
                          const pct = target > 0 ? Math.round((val / target) * 100) : 0;
                          const label = key === "total_in" ? "Money In"
                            : key === "total_out" ? "Total Out"
                            : getGroupLabel(key);
                          return (
                            <p
                              key={key}
                              className="text-sm font-medium"
                              style={{ color: entry.color }}
                            >
                              {label}: <span style={blur}>{formatCents(Math.round(val))}{target > 0 ? ` (${pct}%)` : ""}</span>
                            </p>
                          );
                        })}
                      </div>
                    );
                  }}
                />

                {/* Money In reference line */}
                {hasIncome && visibleGroups.has("total_in") && groupTotals["total_in"] && (
                  <ReferenceLine
                    key="ref-total_in"
                    y={groupTotals["total_in"] / 100}
                    stroke={privacyMode ? "transparent" : "#22c55e"}
                    strokeDasharray="8 4"
                    strokeWidth={1}
                    label={privacyMode ? undefined : { value: `Income $${(groupTotals["total_in"] / 100).toLocaleString()}`, position: "right", fill: "#22c55e", fontSize: 11 }}
                  />
                )}

                {activeGroups.map((group) => {
                  if (!visibleGroups.has(group)) return null;
                  const target = groupTotals[group] || 0;
                  if (target === 0) return null;
                  return (
                    <ReferenceLine
                      key={`ref-${group}`}
                      y={target / 100}
                      stroke={privacyMode ? "transparent" : "oklch(0.50 0 0)"}
                      strokeDasharray="8 4"
                      strokeWidth={1}
                      label={privacyMode ? undefined : {
                        value: `${getGroupLabel(group)} $${(target / 100).toLocaleString()}`,
                        position: "right",
                        fill: "oklch(0.50 0 0)",
                        fontSize: 11,
                      }}
                    />
                  );
                })}

                {/* Money In line */}
                {hasIncome && visibleGroups.has("total_in") && (
                  <Line
                    key="line-total_in"
                    type="monotone"
                    dataKey="total_in"
                    stroke="#22c55e"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                )}

                {/* Total Out line */}
                {visibleGroups.has("total_out") && (
                  <Line
                    key="line-total_out"
                    type="monotone"
                    dataKey="total_out"
                    stroke="#ef4444"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                )}

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
