"use client";

import { useState, useMemo, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fillCumulativeData, CHART_COLORS, formatCents } from "@/lib/utils";
import { usePrivacy } from "@/components/privacy-provider";
import { PrivateYAxisTick } from "@/components/charts/private-axis-tick";
import type { CumulativeTarget } from "@/types";

interface CumulativeProgressChartProps {
  targets: CumulativeTarget[];
  year: number;
  month: number;
  highlightedTargetId?: number | null;
  embedded?: boolean;
}

export function CumulativeProgressChart({
  targets,
  year,
  month,
  highlightedTargetId,
  embedded = false,
}: CumulativeProgressChartProps) {
  const { privacyMode } = usePrivacy();
  const [visibleTargets, setVisibleTargets] = useState<Set<number>>(
    new Set(targets.map((t) => t.target_id))
  );

  // When targets change, make all visible by default
  const targetIds = targets.map((t) => t.target_id).join(",");
  useEffect(() => {
    setVisibleTargets(new Set(targets.map((t) => t.target_id)));
  }, [targetIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Merge all target data into a single dataset keyed by day
  const chartData = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const data: Record<string, number | string>[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const entry: Record<string, number | string> = { date: dateStr, day };

      targets.forEach((target) => {
        const filled = fillCumulativeData(target.data_points, year, month);
        const point = filled.find((p) => p.date === dateStr);
        entry[`target_${target.target_id}`] = point
          ? point.cumulative_value / 100
          : 0;
      });

      data.push(entry);
    }

    return data;
  }, [targets, year, month]);

  const allTargetIds = targets.map((t) => t.target_id);
  const allVisible = allTargetIds.every((id) => visibleTargets.has(id));

  const toggleAll = () => {
    setVisibleTargets(allVisible ? new Set() : new Set(allTargetIds));
  };

  const toggleTarget = (targetId: number) => {
    setVisibleTargets((prev) => {
      const next = new Set(prev);
      if (next.has(targetId)) {
        next.delete(targetId);
      } else {
        next.add(targetId);
      }
      return next;
    });
  };

  if (targets.length === 0) {
    if (embedded) {
      return (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          No target data available for this period.
        </div>
      );
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cumulative Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            No target data available for this period.
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartContent = (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={toggleAll}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-all hover:text-foreground"
          >
            {allVisible ? "Hide All" : "Show All"}
          </button>
          <div className="mx-0.5 h-4 w-px bg-border" />
          {targets.map((target, index) => {
            const color = CHART_COLORS[index % CHART_COLORS.length];
            const isVisible = visibleTargets.has(target.target_id);
            return (
              <button
                key={target.target_id}
                onClick={() => toggleTarget(target.target_id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                  isVisible
                    ? "border-transparent bg-accent text-foreground"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{
                    backgroundColor: isVisible ? color : "oklch(0.45 0 0)",
                  }}
                />
                {target.target_name}
              </button>
            );
          })}
        </div>

        <ResponsiveContainer width="100%" height={350}>
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0 0)" />
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
              tick={<PrivateYAxisTick formatter={(v: number) => `$${v}`} />}
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
                    {payload.map((entry) => (
                      <p
                        key={String(entry.dataKey)}
                        className="text-sm font-medium"
                        style={{ color: entry.color }}
                      >
                        {targets.find(
                          (t) =>
                            `target_${t.target_id}` ===
                            String(entry.dataKey)
                        )?.target_name || String(entry.dataKey)}
                        : <span style={blur}>{formatCents(Math.round((entry.value as number) * 100))}</span>
                      </p>
                    ))}
                  </div>
                );
              }}
            />
            <Legend content={() => null} />

            {/* Target reference lines */}
            {targets.map((target, index) => {
              if (!visibleTargets.has(target.target_id)) return null;
              const color = CHART_COLORS[index % CHART_COLORS.length];
              return (
                <ReferenceLine
                  key={`ref-${target.target_id}`}
                  y={target.target_value / 100}
                  stroke={privacyMode ? "transparent" : color}
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                  label={privacyMode ? undefined : {
                    value: target.target_display,
                    position: "right",
                    fill: color,
                    fontSize: 11,
                  }}
                />
              );
            })}

            {/* Target lines */}
            {targets.map((target, index) => {
              if (!visibleTargets.has(target.target_id)) return null;
              const color = CHART_COLORS[index % CHART_COLORS.length];
              return (
                <Line
                  key={`line-${target.target_id}`}
                  type="monotone"
                  dataKey={`target_${target.target_id}`}
                  stroke={color}
                  strokeWidth={
                    highlightedTargetId === target.target_id ? 3 : 2
                  }
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
    </>
  );

  if (embedded) return chartContent;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cumulative Progress</CardTitle>
      </CardHeader>
      <CardContent>{chartContent}</CardContent>
    </Card>
  );
}
