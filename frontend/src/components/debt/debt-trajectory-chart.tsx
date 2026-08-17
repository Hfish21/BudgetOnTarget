"use client";

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
import { formatCents } from "@/lib/utils";
import { usePrivacy } from "@/components/privacy-provider";
import { PrivateYAxisTick } from "@/components/charts/private-axis-tick";
import type { DebtTrajectory, DebtScenarioPoint } from "@/types";

const ACTUAL_COLOR = "#0ea5e9"; // sky-500
const PROJECTED_COLOR = "#8b5cf6"; // violet-500
const PLANNED_COLOR = "oklch(0.6 0 0)"; // neutral grey reference

export type ScenarioTone = "ahead" | "behind" | "unpayable";
const TONE_COLOR: Record<ScenarioTone, string> = {
  ahead: "#10b981", // emerald-500
  behind: "#f59e0b", // amber-500
  unpayable: "#ef4444", // red-500
};

interface DebtTrajectoryChartProps {
  trajectory: DebtTrajectory;
  scenarioCurve?: DebtScenarioPoint[] | null;
  scenarioLabel?: string;
  scenarioTone?: ScenarioTone;
  /** Month label ("Jul 2027") of the current-plan payoff, to mark on the axis. */
  planPayoffLabel?: string | null;
  /** Month label of the what-if payoff, to mark on the axis. */
  scenarioPayoffLabel?: string | null;
}

function dashSwatch(color: string, gap = "4px 7px", on = "0 4px") {
  return {
    backgroundImage: `repeating-linear-gradient(to right, ${color} ${on}, transparent ${gap})`,
  };
}

/** "Jul 2027" -> "Jul '27" for compact axis ticks. */
function shortMonth(label: string): string {
  const [mon, yr] = label.split(" ");
  return yr ? `${mon} '${yr.slice(2)}` : label;
}

export function DebtTrajectoryChart({
  trajectory,
  scenarioCurve,
  scenarioLabel,
  scenarioTone = "ahead",
  planPayoffLabel,
  scenarioPayoffLabel,
}: DebtTrajectoryChartProps) {
  const { privacyMode } = usePrivacy();
  const scenarioColor = TONE_COLOR[scenarioTone];
  const showScenario = !!scenarioCurve && scenarioCurve.length > 0;

  // Merge the trajectory and optional scenario curves into one dataset keyed by
  // month, so a scenario that pays off sooner/later still lines up.
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

  const seriesName: Record<string, string> = {
    actual: "Actual",
    projected: "Current plan",
    planned: "Ideal (from start)",
    scenario: scenarioLabel ?? "What-if",
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ backgroundColor: ACTUAL_COLOR }} />
          Actual so far
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={dashSwatch(PROJECTED_COLOR)} />
          Current plan
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={dashSwatch(PLANNED_COLOR, "3px 6px", "0 3px")} />
          Ideal (from start)
        </span>
        {showScenario && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ backgroundColor: scenarioColor }} />
            {scenarioLabel ?? "What-if"}
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={data} margin={{ top: 10, right: 56, left: 10, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0 0)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={48}
            fontSize={10}
            tickFormatter={shortMonth}
            tick={{ fill: "oklch(0.6 0 0)" }}
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

          {/* Payoff-month markers, so the exact month is unambiguous. */}
          {planPayoffLabel && (
            <ReferenceLine
              x={planPayoffLabel}
              stroke={PROJECTED_COLOR}
              strokeDasharray="2 3"
              label={
                privacyMode
                  ? undefined
                  : {
                      value: `Plan: ${shortMonth(planPayoffLabel)}`,
                      position: "top",
                      fill: PROJECTED_COLOR,
                      fontSize: 10,
                    }
              }
            />
          )}
          {showScenario && scenarioPayoffLabel && (
            <ReferenceLine
              x={scenarioPayoffLabel}
              stroke={scenarioColor}
              strokeDasharray="2 3"
              label={
                privacyMode
                  ? undefined
                  : {
                      value: `What-if: ${shortMonth(scenarioPayoffLabel)}`,
                      position: "top",
                      fill: scenarioColor,
                      fontSize: 10,
                    }
              }
            />
          )}

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
