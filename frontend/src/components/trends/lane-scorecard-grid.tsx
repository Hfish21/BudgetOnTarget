"use client";

import { LaneScorecard } from "./lane-scorecard";
import { GROUP_ORDER, getGroupLabel } from "@/lib/utils";
import type { LaneHistoryMonth, SpendGroup } from "@/types";
import type { TargetWithHistory } from "@/app/trends/page";

interface LaneScorecardGridProps {
  data: Record<string, LaneHistoryMonth[]>;
  targetData: TargetWithHistory[];
  selectedLane: SpendGroup | null;
  onLaneClick: (lane: SpendGroup) => void;
}

export function LaneScorecardGrid({ data, targetData, selectedLane, onLaneClick }: LaneScorecardGridProps) {
  const activeLanes = GROUP_ORDER.filter((g) => data[g] && data[g].length > 0);

  if (activeLanes.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {activeLanes.map((lane) => (
        <LaneScorecard
          key={lane}
          lane={lane as SpendGroup}
          label={getGroupLabel(lane)}
          months={data[lane]}
          targets={targetData}
          selected={selectedLane === lane}
          dimmed={selectedLane !== null && selectedLane !== lane}
          onClick={() => onLaneClick(lane as SpendGroup)}
        />
      ))}
    </div>
  );
}
