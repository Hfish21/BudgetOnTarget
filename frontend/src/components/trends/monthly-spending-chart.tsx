"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GROUP_COLORS, GROUP_ORDER, getGroupLabel, formatCents, CHART_COLORS, cn } from "@/lib/utils";
import { usePrivacy } from "@/components/privacy-provider";
import { PrivateYAxisTick } from "@/components/charts/private-axis-tick";
import { Money } from "@/components/money";
import { InfoTip } from "./info-tip";
import type { LaneHistoryMonth, SpendGroup } from "@/types";
import type { TargetWithHistory } from "@/app/trends/page";

interface MonthlySpendingChartProps {
  data: Record<string, LaneHistoryMonth[]>;
  targetData: TargetWithHistory[];
  selectedLane: SpendGroup | null;
}

interface LaneChartRow {
  label: string;
  necessary: number;
  discretionary: number;
  anomalous: number;
  income: number;
  incomeTarget: number;
  spendingTarget: number;
}

type CategoryChartRow = Record<string, number | string>;

const yAxisFormatter = (value: number) =>
  value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value}`;

export function MonthlySpendingChart({ data, targetData, selectedLane }: MonthlySpendingChartProps) {
  const [view, setView] = useState<"lane" | "category">("lane");
  const { privacyMode } = usePrivacy();

  const laneChartData = useMemo(() => {
    const allMonths = new Map<string, LaneChartRow>();
    const lanesToShow = selectedLane
      ? [selectedLane]
      : GROUP_ORDER;

    for (const group of GROUP_ORDER) {
      const months = data[group] || [];
      for (const m of months) {
        const key = `${m.year}-${String(m.month).padStart(2, "0")}`;
        if (!allMonths.has(key)) {
          allMonths.set(key, {
            label: m.label,
            necessary: 0,
            discretionary: 0,
            anomalous: 0,
            income: 0,
            incomeTarget: 0,
            spendingTarget: 0,
          });
        }
        const row = allMonths.get(key)!;
        const dollars = m.actual_value / 100;
        const targetDollars = m.target_value / 100;

        if (group === "income") {
          row.income = dollars;
          row.incomeTarget = targetDollars;
        } else {
          row[group as "necessary" | "discretionary" | "anomalous"] = dollars;
          if (lanesToShow.includes(group)) {
            row.spendingTarget += targetDollars;
          }
        }
      }
    }

    return Array.from(allMonths.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, row]) => row);
  }, [data, selectedLane]);

  const { categoryChartData, categoryKeys, categoryColors } = useMemo(() => {
    const targets = selectedLane
      ? targetData.filter((t) => t.spendGroup === selectedLane)
      : targetData.filter((t) => t.spendGroup !== "income");

    const keys = targets.map((t) => t.name);
    const colors: Record<string, string> = {};
    targets.forEach((t, i) => {
      colors[t.name] = CHART_COLORS[i % CHART_COLORS.length];
    });

    const monthMap = new Map<string, CategoryChartRow>();
    for (const t of targets) {
      for (const m of t.months) {
        const key = `${m.year}-${String(m.month).padStart(2, "0")}`;
        if (!monthMap.has(key)) {
          monthMap.set(key, { label: m.label });
        }
        const row = monthMap.get(key)!;
        row[t.name] = m.actual_value / 100;
      }
    }

    const sorted = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, row]) => row);

    return { categoryChartData: sorted, categoryKeys: keys, categoryColors: colors };
  }, [targetData, selectedLane]);

  const activeView = view;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartData: any[] = activeView === "lane" ? laneChartData : categoryChartData;

  const spendingLanes = selectedLane
    ? (selectedLane === "income" ? [] : [selectedLane])
    : GROUP_ORDER.filter((g) => g !== "income" && data[g]?.length > 0);

  const hasIncome = (data["income"]?.length ?? 0) > 0;
  const showIncomeBar = hasIncome && activeView === "lane" && selectedLane !== "income";
  const showIncomeSolo = selectedLane === "income" && activeView === "lane";

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monthly Spending</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            No data available.
          </div>
        </CardContent>
      </Card>
    );
  }

  const avgSpendingTarget = activeView === "lane" && laneChartData.length > 0 && !showIncomeSolo
    ? laneChartData.reduce((s, d) => s + d.spendingTarget, 0) / laneChartData.length
    : 0;

  const title = selectedLane
    ? `Monthly ${getGroupLabel(selectedLane)}`
    : "Monthly Income vs Spending";

  const infoText = activeView === "lane"
    ? showIncomeBar
      ? "Green bars show income, colored stacked bars show spending broken down by lane. Compare the heights to see your margin each month. Click a lane card above to filter."
      : "Total spending each month, broken down by lane. The dashed line shows your target. Click a lane card above to filter."
    : "Total spending each month, broken down by individual target. Helps identify which specific categories drive your spending.";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CardTitle>{title}</CardTitle>
            <InfoTip text={infoText} />
          </div>
          {!showIncomeSolo ? (
            <div className="flex rounded-lg bg-muted p-0.5">
              <button
                onClick={() => setView("lane")}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-all",
                  activeView === "lane"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                By Lane
              </button>
              <button
                onClick={() => setView("category")}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-all",
                  activeView === "category"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                By Target
              </button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={380}>
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
            barGap={0}
            barCategoryGap="20%"
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
              interval={chartData.length > 12 ? Math.floor(chartData.length / 8) : 0}
              angle={chartData.length > 6 ? -45 : 0}
              textAnchor={chartData.length > 6 ? "end" : "middle"}
              height={chartData.length > 6 ? 60 : 30}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={<PrivateYAxisTick formatter={yAxisFormatter} />}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as LaneChartRow;
                const blur = privacyMode ? { filter: "blur(8px)", userSelect: "none" as const } : undefined;
                if (activeView === "category") {
                  return (
                    <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
                      <p className="mb-1 text-xs font-medium text-foreground">{d.label}</p>
                      {payload.map((entry) => {
                        const val = entry.value as number;
                        if (!val || val === 0) return null;
                        return (
                          <p key={entry.dataKey as string} className="text-sm" style={{ color: entry.color }}>
                            {entry.dataKey as string}: <span style={blur}>{formatCents(Math.round(val * 100))}</span>
                          </p>
                        );
                      })}
                    </div>
                  );
                }
                const totalSpend = (d.necessary || 0) + (d.discretionary || 0) + (d.anomalous || 0);
                const net = d.income - totalSpend;
                return (
                  <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
                    <p className="mb-1 text-xs font-medium text-foreground">{d.label}</p>
                    {d.income > 0 && (
                      <p className="text-sm" style={{ color: GROUP_COLORS.income }}>
                        Income: <span style={blur}>{formatCents(Math.round(d.income * 100))}</span>
                      </p>
                    )}
                    {spendingLanes.length > 0 && (
                      <div className="mt-0.5">
                        {d.necessary > 0 && spendingLanes.includes("necessary") && (
                          <p className="text-sm" style={{ color: GROUP_COLORS.necessary }}>
                            Necessary: <span style={blur}>{formatCents(Math.round(d.necessary * 100))}</span>
                          </p>
                        )}
                        {d.discretionary > 0 && spendingLanes.includes("discretionary") && (
                          <p className="text-sm" style={{ color: GROUP_COLORS.discretionary }}>
                            Discretionary: <span style={blur}>{formatCents(Math.round(d.discretionary * 100))}</span>
                          </p>
                        )}
                        {d.anomalous > 0 && spendingLanes.includes("anomalous") && (
                          <p className="text-sm" style={{ color: GROUP_COLORS.anomalous }}>
                            Anomalous: <span style={blur}>{formatCents(Math.round(d.anomalous * 100))}</span>
                          </p>
                        )}
                        <p className="mt-1 border-t border-border pt-1 text-xs text-muted-foreground">
                          Total Spend: <span style={blur}>{formatCents(Math.round(totalSpend * 100))}</span>
                        </p>
                      </div>
                    )}
                    {d.income > 0 && totalSpend > 0 && (
                      <p className={`text-xs font-medium ${net >= 0 ? "text-green-400" : "text-red-400"}`}>
                        Net: <span style={blur}>{net >= 0 ? "+" : ""}{formatCents(Math.round(net * 100))}</span>
                      </p>
                    )}
                  </div>
                );
              }}
            />

            {activeView === "lane" && avgSpendingTarget > 0 && (
              <ReferenceLine
                y={privacyMode ? undefined : avgSpendingTarget}
                stroke={privacyMode ? "transparent" : "oklch(0.50 0 0)"}
                strokeDasharray="8 4"
                strokeWidth={1}
                label={privacyMode ? undefined : {
                  value: `Spend Target: ${formatCents(Math.round(avgSpendingTarget * 100))}`,
                  position: "insideTopRight",
                  fill: "oklch(0.50 0 0)",
                  fontSize: 11,
                }}
              />
            )}

            {activeView === "lane" ? (
              <>
                {showIncomeBar && (
                  <Bar
                    dataKey="income"
                    stackId="income"
                    fill={GROUP_COLORS.income}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={52}
                    fillOpacity={0.85}
                  />
                )}
                {spendingLanes.includes("necessary") && (
                  <Bar dataKey="necessary" stackId="spending" fill={GROUP_COLORS.necessary} maxBarSize={52} />
                )}
                {spendingLanes.includes("discretionary") && (
                  <Bar dataKey="discretionary" stackId="spending" fill={GROUP_COLORS.discretionary} maxBarSize={52} />
                )}
                {spendingLanes.includes("anomalous") && (
                  <Bar dataKey="anomalous" stackId="spending" fill={GROUP_COLORS.anomalous} radius={[4, 4, 0, 0]} maxBarSize={52} />
                )}
                {showIncomeSolo && (
                  <Bar dataKey="income" fill={GROUP_COLORS.income} radius={[4, 4, 0, 0]} maxBarSize={52} />
                )}
              </>
            ) : (
              categoryKeys.map((key, i) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="categories"
                  fill={categoryColors[key]}
                  radius={i === categoryKeys.length - 1 ? [4, 4, 0, 0] : undefined}
                  maxBarSize={48}
                />
              ))
            )}

            <Legend
              content={() => (
                <div className="mt-3 flex flex-wrap justify-center gap-3">
                  {activeView === "lane" ? (
                    <>
                      {(showIncomeBar || showIncomeSolo) && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: GROUP_COLORS.income }} />
                          Income
                        </div>
                      )}
                      {spendingLanes.map((g) => (
                        <div key={g} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: GROUP_COLORS[g] }} />
                          {getGroupLabel(g)}
                        </div>
                      ))}
                    </>
                  ) : (
                    categoryKeys.map((key) => (
                      <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: categoryColors[key] }} />
                        {key}
                      </div>
                    ))
                  )}
                </div>
              )}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
