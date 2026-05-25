"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "./info-tip";
import { Money } from "@/components/money";
import { usePrivacy } from "@/components/privacy-provider";
import { PrivateYAxisTick } from "@/components/charts/private-axis-tick";
import { GROUP_ORDER, formatCents } from "@/lib/utils";
import type { LaneHistoryMonth } from "@/types";

interface NetCashFlowChartProps {
  data: Record<string, LaneHistoryMonth[]>;
}

interface FlowPoint {
  label: string;
  income: number;
  spending: number;
  net: number;
  positive: number;
  negative: number;
}

const yAxisFormatter = (value: number) =>
  value >= 1000
    ? `$${(value / 1000).toFixed(0)}k`
    : value <= -1000
      ? `-$${(Math.abs(value) / 1000).toFixed(0)}k`
      : `$${value}`;

export function NetCashFlowChart({ data }: NetCashFlowChartProps) {
  const { privacyMode } = usePrivacy();
  const chartData = useMemo(() => {
    const monthMap = new Map<string, FlowPoint>();

    for (const group of GROUP_ORDER) {
      const months = data[group] || [];
      for (const m of months) {
        const key = `${m.year}-${String(m.month).padStart(2, "0")}`;
        if (!monthMap.has(key)) {
          monthMap.set(key, {
            label: m.label,
            income: 0,
            spending: 0,
            net: 0,
            positive: 0,
            negative: 0,
          });
        }
        const row = monthMap.get(key)!;
        const dollars = m.actual_value / 100;
        if (group === "income") {
          row.income = dollars;
        } else {
          row.spending += dollars;
        }
      }
    }

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, row]) => {
        row.net = row.income - row.spending;
        row.positive = Math.max(0, row.net);
        row.negative = Math.min(0, row.net);
        return row;
      });
  }, [data]);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Net Cash Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            No data available.
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalNet = chartData.reduce((s, d) => s + d.net, 0);
  const avgNet = totalNet / chartData.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CardTitle>Net Cash Flow</CardTitle>
            <InfoTip text="Income minus total spending each month. Green area means surplus (saving), red means deficit (spending more than you earn). A downward slope means your margin is shrinking." />
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5">
              <div className="text-right">
                <p className={`text-lg font-bold tabular-nums ${totalNet >= 0 ? "text-green-400" : "text-red-400"}`}>
                  <Money>{totalNet >= 0 ? "+" : ""}{formatCents(Math.round(totalNet * 100))}</Money>
                </p>
                <p className="text-[11px] text-muted-foreground">total net</p>
              </div>
              <InfoTip text={`Total money saved (or lost) across all ${chartData.length} months in this period.`} />
            </div>
            <div className="text-right">
              <p className={`text-sm font-semibold tabular-nums ${avgNet >= 0 ? "text-green-400" : "text-red-400"}`}>
                <Money>{avgNet >= 0 ? "+" : ""}{formatCents(Math.round(avgNet * 100))}/mo</Money>
              </p>
              <p className="text-[11px] text-muted-foreground">avg net</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
          >
            <defs>
              <linearGradient id="fillPositive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="fillNegative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.05} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.3} />
              </linearGradient>
            </defs>
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
                if (!active || !payload?.[0]) return null;
                const d = payload[0].payload as FlowPoint;
                const blur = privacyMode ? { filter: "blur(8px)", userSelect: "none" as const } : undefined;
                return (
                  <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
                    <p className="mb-1 text-xs font-medium text-foreground">
                      {d.label}
                    </p>
                    <p className="text-sm text-emerald-400">
                      Income: <span style={blur}>{formatCents(Math.round(d.income * 100))}</span>
                    </p>
                    <p className="text-sm text-red-400">
                      Spending: <span style={blur}>{formatCents(Math.round(d.spending * 100))}</span>
                    </p>
                    <p
                      className={`mt-1 border-t border-border pt-1 text-sm font-medium ${d.net >= 0 ? "text-green-400" : "text-red-400"}`}
                    >
                      Net: <span style={blur}>{d.net >= 0 ? "+" : ""}{formatCents(Math.round(d.net * 100))}</span>
                    </p>
                  </div>
                );
              }}
            />
            <ReferenceLine
              y={0}
              stroke="oklch(0.40 0 0)"
              strokeWidth={1}
            />
            <Area
              type="monotone"
              dataKey="positive"
              stroke="#34d399"
              strokeWidth={2}
              fill="url(#fillPositive)"
            />
            <Area
              type="monotone"
              dataKey="negative"
              stroke="#ef4444"
              strokeWidth={2}
              fill="url(#fillNegative)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
