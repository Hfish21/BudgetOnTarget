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
import type { CumulativeTarget } from "@/types";

interface CumulativeProgressChartProps {
  targets: CumulativeTarget[];
  year: number;
  month: number;
  highlightedTargetId?: number | null;
}

export function CumulativeProgressChart({
  targets,
  year,
  month,
  highlightedTargetId,
}: CumulativeProgressChartProps) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cumulative Progress</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Legend with toggle buttons */}
        <div className="mb-4 flex flex-wrap gap-2">
          {targets.map((target, index) => {
            const color = CHART_COLORS[index % CHART_COLORS.length];
            const isVisible = visibleTargets.has(target.target_id);
            return (
              <button
                key={target.target_id}
                onClick={() => toggleTarget(target.target_id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                  isVisible
                    ? "border-transparent bg-gray-100 text-gray-900"
                    : "border-gray-200 bg-white text-gray-400"
                }`}
              >
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{
                    backgroundColor: isVisible ? color : "#d1d5db",
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
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              fontSize={12}
              tick={{ fill: "#9ca3af" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={12}
              tick={{ fill: "#9ca3af" }}
              tickFormatter={(value: number) => `$${value}`}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload) return null;
                return (
                  <div className="rounded-lg border bg-white px-3 py-2 shadow-md">
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
                        : {formatCents(Math.round((entry.value as number) * 100))}
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
                  stroke={color}
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                  label={{
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
      </CardContent>
    </Card>
  );
}
