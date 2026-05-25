"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { GROUP_ORDER, getGroupLabel } from "@/lib/utils";
import { NetSummary } from "@/components/dashboard/net-summary";
import { GroupSection } from "@/components/dashboard/group-section";
import { GroupCumulativeChart } from "@/components/charts/group-cumulative-chart";
import { TargetTransactionsDialog } from "@/components/dashboard/target-transactions-dialog";
import type {
  DashboardResponse,
  CumulativeResponse,
  TargetAssessment,
  SpendGroup,
} from "@/types";

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
  const [selectedAssessment, setSelectedAssessment] = useState<TargetAssessment | null>(null);
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
    const found = assessments.find((a) => a.target_id === targetId) || null;
    setSelectedAssessment(found);
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
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-96 animate-pulse rounded-xl bg-muted" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-xl bg-muted"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6">
        <p className="text-sm text-destructive">
          Failed to load dashboard: {error}
        </p>
      </div>
    );
  }

  const assessments = dashboard?.assessments || [];

  const groupedAssessments: Record<string, TargetAssessment[]> = {};
  for (const a of assessments) {
    const group = a.spend_group;
    if (!groupedAssessments[group]) groupedAssessments[group] = [];
    groupedAssessments[group].push(a);
  }

  const activeGroups = GROUP_ORDER.filter(
    (g) => groupedAssessments[g] && groupedAssessments[g].length > 0
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          {dashboard?.period.label || ""}
        </p>
      </div>

      <NetSummary assessments={assessments} />

      <section ref={chartRef}>
        <GroupCumulativeChart
          targets={cumulative?.targets || []}
          year={parseInt(year, 10)}
          month={parseInt(month, 10)}
          highlightedTargetId={highlightedTarget}
        />
      </section>

      <div className="space-y-6">
        {activeGroups.map((group) => (
          <GroupSection
            key={group}
            groupName={getGroupLabel(group)}
            groupKey={group as SpendGroup}
            assessments={groupedAssessments[group]}
            onCardClick={handleCardClick}
          />
        ))}
      </div>

      <TargetTransactionsDialog
        assessment={selectedAssessment}
        year={parseInt(year, 10)}
        month={parseInt(month, 10)}
        open={selectedAssessment !== null}
        onOpenChange={(open) => { if (!open) setSelectedAssessment(null); }}
      />
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
