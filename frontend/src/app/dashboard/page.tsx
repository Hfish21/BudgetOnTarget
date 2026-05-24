"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { TargetGrid } from "@/components/dashboard/target-grid";
import { CumulativeProgressChart } from "@/components/charts/cumulative-progress-chart";
import type { DashboardResponse, CumulativeResponse } from "@/types";

function DashboardContent() {
  const searchParams = useSearchParams();
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [cumulative, setCumulative] = useState<CumulativeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlightedTarget, setHighlightedTarget] = useState<number | null>(
    null
  );
  const chartRef = useRef<HTMLDivElement>(null);

  const fetchDashboard = useCallback(async (y: number, m: number) => {
    setLoading(true);
    setError(null);
    try {
      const [dashData, cumData] = await Promise.all([
        api.dashboard.getAssessments(y, m),
        api.dashboard.getCumulative(y, m),
      ]);
      setDashboard(dashData);
      setCumulative(cumData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load dashboard data"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!year || !month) return;
    fetchDashboard(parseInt(year, 10), parseInt(month, 10));
  }, [year, month, fetchDashboard]);

  const handleCardClick = (targetId: number) => {
    setHighlightedTarget(targetId);
    chartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!year || !month) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Select a month from the sidebar to view your dashboard.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-xl bg-gray-200"
            />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-xl bg-gray-200" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="text-sm text-red-700">
          Failed to load dashboard: {error}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          {dashboard?.period.label || ""}
        </p>
      </div>

      <section>
        <h3 className="mb-4 text-lg font-semibold">Target Assessments</h3>
        <TargetGrid
          assessments={dashboard?.assessments || []}
          onCardClick={handleCardClick}
        />
      </section>

      <section ref={chartRef}>
        <CumulativeProgressChart
          targets={cumulative?.targets || []}
          year={parseInt(year, 10)}
          month={parseInt(month, 10)}
          highlightedTargetId={highlightedTarget}
        />
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
