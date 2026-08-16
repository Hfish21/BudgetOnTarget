"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCents } from "@/lib/utils";
import { usePrivacy } from "@/components/privacy-provider";
import { PrivateYAxisTick } from "@/components/charts/private-axis-tick";
import type { DebtTrajectory } from "@/types";

const ACTUAL_COLOR = "#0ea5e9"; // sky-500
const PROJECTED_COLOR = "#8b5cf6"; // violet-500
const PLANNED_COLOR = "oklch(0.6 0 0)"; // neutral grey reference

interface DebtTrajectoryChartProps {
  trajectory: DebtTrajectory;
}

export function DebtTrajectoryChart({ trajectory }: DebtTrajectoryChartProps) {
  const { privacyMode } = usePrivacy();

  const data = trajectory.curve.map((p) => ({
    label: p.label,
    actual: p.actual_balance != null ? p.actual_balance / 100 : null,
    projected: p.projected_balance != null ? p.projected_balance / 100 : null,
    planned: p.planned_balance != null ? p.planned_balance / 100 : null,
  }));

  // With many months, thin the x-axis labels so they don't collide.
  const interval = Math.max(0, Math.ceil(data.length / 8) - 1);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ backgroundColor: ACTUAL_COLOR }} />
          Actual
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4"
            style={{
              backgroundImage: `repeating-linear-gradient(to right, ${PROJECTED_COLOR} 0 4px, transparent 4px 7px)`,
            }}
          />
          Projected (on plan)
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4"
            style={{
              backgroundImage: `repeating-linear-gradient(to right, ${PLANNED_COLOR} 0 3px, transparent 3px 6px)`,
            }}
          />
          Plan baseline
        </span>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 5, right: 16, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0 0)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            interval={interval}
            tick={{ fill: "oklch(0.65 0 0)" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={64}
            tick={
              <PrivateYAxisTick
                formatter={(v: number) => `$${v.toLocaleString("en-US")}`}
              />
            }
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              const blur = privacyMode
                ? { filter: "blur(8px)", userSelect: "none" as const }
                : undefined;
              return (
                <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
                  <p className="mb-1 text-xs text-muted-foreground">{label}</p>
                  {payload.map((entry) => (
                    <p
                      key={String(entry.dataKey)}
                      className="text-sm font-medium"
                      style={{ color: entry.color }}
                    >
                      {entry.dataKey === "actual"
                        ? "Actual"
                        : entry.dataKey === "projected"
                          ? "Projected"
                          : "Plan"}
                      :{" "}
                      <span style={blur}>
                        {formatCents(Math.round((entry.value as number) * 100))}
                      </span>
                    </p>
                  ))}
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="planned"
            stroke={PLANNED_COLOR}
            strokeWidth={1.5}
            strokeDasharray="3 3"
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="projected"
            stroke={PROJECTED_COLOR}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke={ACTUAL_COLOR}
            strokeWidth={2.5}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
