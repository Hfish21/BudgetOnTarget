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
import type { DebtTrajectory, DebtScenarioPoint } from "@/types";

const ACTUAL_COLOR = "#0ea5e9"; // sky-500
const PROJECTED_COLOR = "#8b5cf6"; // violet-500
const PLANNED_COLOR = "oklch(0.6 0 0)"; // neutral grey reference
const SCENARIO_AHEAD_COLOR = "#10b981"; // emerald-500 (paying ahead)
const SCENARIO_BEHIND_COLOR = "#f59e0b"; // amber-500 (paying slower)

interface DebtTrajectoryChartProps {
  trajectory: DebtTrajectory;
  /** Optional "what if" scenario curve to overlay (from the extra-payment explorer). */
  scenarioCurve?: DebtScenarioPoint[] | null;
  scenarioLabel?: string;
  /** True when the scenario pays off sooner than the current plan (draw it green). */
  scenarioAhead?: boolean;
}

function dashSwatch(color: string, gap = "4px 7px", on = "0 4px") {
  return {
    backgroundImage: `repeating-linear-gradient(to right, ${color} ${on}, transparent ${gap})`,
  };
}

export function DebtTrajectoryChart({
  trajectory,
  scenarioCurve,
  scenarioLabel,
  scenarioAhead = true,
}: DebtTrajectoryChartProps) {
  const { privacyMode } = usePrivacy();
  const scenarioColor = scenarioAhead ? SCENARIO_AHEAD_COLOR : SCENARIO_BEHIND_COLOR;
  const showScenario = !!scenarioCurve && scenarioCurve.length > 0;

  // Merge the trajectory curve and the optional scenario curve into one dataset
  // keyed by month, so a scenario that pays off sooner (or later) still lines up.
  const rowByKey = new Map<
    string,
    {
      label: string;
      actual: number | null;
      projected: number | null;
      planned: number | null;
      scenario: number | null;
    }
  >();
  for (const p of trajectory.curve) {
    rowByKey.set(p.month_key, {
      label: p.label,
      actual: p.actual_balance != null ? p.actual_balance / 100 : null,
      projected: p.projected_balance != null ? p.projected_balance / 100 : null,
      planned: p.planned_balance != null ? p.planned_balance / 100 : null,
      scenario: null,
    });
  }
  if (showScenario) {
    for (const p of scenarioCurve!) {
      let row = rowByKey.get(p.month_key);
      if (!row) {
        row = { label: p.label, actual: null, projected: null, planned: null, scenario: null };
        rowByKey.set(p.month_key, row);
      }
      row.scenario = p.balance / 100;
    }
  }
  const data = [...rowByKey.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([, row]) => row);

  const interval = Math.max(0, Math.ceil(data.length / 8) - 1);

  const seriesName: Record<string, string> = {
    actual: "Actual",
    projected: "Projected",
    planned: "Plan",
    scenario: scenarioLabel ?? "With extra",
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ backgroundColor: ACTUAL_COLOR }} />
          Actual
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={dashSwatch(PROJECTED_COLOR)} />
          Projected (on plan)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={dashSwatch(PLANNED_COLOR, "3px 6px", "0 3px")} />
          Plan baseline
        </span>
        {showScenario && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ backgroundColor: scenarioColor }} />
            {scenarioLabel ?? "With extra"}
          </span>
        )}
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
                      {seriesName[String(entry.dataKey)] ?? String(entry.dataKey)}:{" "}
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
          {showScenario && (
            <Line
              type="monotone"
              dataKey="scenario"
              stroke={scenarioColor}
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
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
