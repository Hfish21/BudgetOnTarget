"use client";

import { TargetCard } from "./target-card";
import type { TargetAssessment } from "@/types";

interface TargetGridProps {
  assessments: TargetAssessment[];
  onCardClick?: (targetId: number) => void;
}

export function TargetGrid({ assessments, onCardClick }: TargetGridProps) {
  if (assessments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No targets configured for this period. Create targets on the Targets
          page to see assessments here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {assessments.map((assessment) => (
        <TargetCard
          key={assessment.target_id}
          assessment={assessment}
          onClick={() => onCardClick?.(assessment.target_id)}
        />
      ))}
    </div>
  );
}
