"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { api } from "@/lib/api";
import { GROUP_ORDER } from "@/lib/utils";
import { TimeRangeSelector, type TimeRange } from "@/components/trends/time-range-selector";
import { LaneScorecardGrid } from "@/components/trends/lane-scorecard-grid";
import { MonthlySpendingChart } from "@/components/trends/monthly-spending-chart";
import { NetCashFlowChart } from "@/components/trends/net-cash-flow-chart";
import type { LaneHistoryMonth, SpendGroup, TargetHistoryMonth, Target } from "@/types";

const RANGE_MONTHS: Record<TimeRange, number | null> = {
  "3m": 3,
  "6m": 6,
  "12m": 12,
  all: null,
};

export interface TargetWithHistory {
  id: number;
  name: string;
  spendGroup: SpendGroup;
  months: TargetHistoryMonth[];
}

export default function TrendsPage() {
  const [range, setRange] = useState<TimeRange>("12m");
  const [allData, setAllData] = useState<Record<string, LaneHistoryMonth[]>>({});
  const [targetData, setTargetData] = useState<TargetWithHistory[]>([]);
  const [selectedLane, setSelectedLane] = useState<SpendGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [laneResults, targets] = await Promise.all([
        Promise.all(GROUP_ORDER.map((group) => api.dashboard.getLaneHistory(group))),
        api.targets.list(),
      ]);

      const data: Record<string, LaneHistoryMonth[]> = {};
      for (let i = 0; i < GROUP_ORDER.length; i++) {
        data[GROUP_ORDER[i]] = laneResults[i].months;
      }
      setAllData(data);

      const activeTargets = targets.filter((t: Target) => t.is_active);
      const BATCH_SIZE = 5;
      const results: PromiseSettledResult<ReturnType<typeof api.dashboard.getTargetHistory> extends Promise<infer U> ? U : never>[] = [];
      for (let i = 0; i < activeTargets.length; i += BATCH_SIZE) {
        const batch = activeTargets.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.allSettled(
          batch.map((t: Target) => api.dashboard.getTargetHistory(t.id))
        );
        results.push(...batchResults);
      }
      setTargetData(
        activeTargets
          .map((t: Target, i: number) => {
            const r = results[i];
            if (r.status !== "fulfilled") return null;
            return {
              id: t.id,
              name: t.name,
              spendGroup: t.spend_group,
              months: r.value.months,
            };
          })
          .filter((t): t is TargetWithHistory => t !== null)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trend data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filteredData = useMemo(() => {
    const limit = RANGE_MONTHS[range];
    if (limit === null) return allData;

    const filtered: Record<string, LaneHistoryMonth[]> = {};
    for (const [group, months] of Object.entries(allData)) {
      filtered[group] = months.slice(-limit);
    }
    return filtered;
  }, [allData, range]);

  const filteredTargetData = useMemo(() => {
    const limit = RANGE_MONTHS[range];
    if (limit === null) return targetData;
    return targetData.map((t) => ({ ...t, months: t.months.slice(-limit) }));
  }, [targetData, range]);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-32 animate-pulse rounded bg-muted" />
            <div className="h-4 w-48 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6">
        <p className="text-sm text-destructive">
          Failed to load trends: {error}
        </p>
      </div>
    );
  }

  const hasData = Object.values(filteredData).some((m) => m.length > 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Trends</h2>
          <p className="text-sm text-muted-foreground">
            Multi-month spending overview
          </p>
        </div>
        <TimeRangeSelector value={range} onChange={setRange} />
      </div>

      {!hasData ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border">
          <p className="text-sm text-muted-foreground">
            No historical data available yet.
          </p>
        </div>
      ) : (
        <>
          <LaneScorecardGrid
            data={filteredData}
            targetData={filteredTargetData}
            selectedLane={selectedLane}
            onLaneClick={(lane) =>
              setSelectedLane(selectedLane === lane ? null : lane)
            }
          />
          <MonthlySpendingChart
            data={filteredData}
            targetData={filteredTargetData}
            selectedLane={selectedLane}
          />
          <NetCashFlowChart data={filteredData} />
        </>
      )}
    </div>
  );
}
