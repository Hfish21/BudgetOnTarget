import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const formatted = `$${(abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  return cents < 0 ? `-${formatted}` : formatted;
}

export function getStatusBgColor(status: string): string {
  switch (status) {
    case "on_target":
      return "bg-green-500";
    case "in_tolerance":
      return "bg-yellow-500";
    case "off_target":
      return "bg-red-500";
    default:
      return "bg-gray-400";
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case "on_target":
      return "On Target";
    case "in_tolerance":
      return "In Tolerance";
    case "off_target":
      return "Off Target";
    default:
      return "Unknown";
  }
}

export function getDirectionLabel(direction: string): string {
  switch (direction) {
    case "at_most":
      return "at most";
    case "at_least":
      return "at least";
    case "exactly":
      return "exactly";
    default:
      return direction;
  }
}

export function fillCumulativeData(
  dataPoints: { date: string; cumulative_value: number }[],
  year: number,
  month: number
): { date: string; cumulative_value: number }[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const filled: { date: string; cumulative_value: number }[] = [];
  let lastValue = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const point = dataPoints.find((p) => p.date === dateStr);
    if (point) {
      lastValue = point.cumulative_value;
    }
    filled.push({ date: dateStr, cumulative_value: lastValue });
  }
  return filled;
}

export const CHART_COLORS = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#8b5cf6", // violet-500
  "#f59e0b", // amber-500
  "#f43f5e", // rose-500
  "#06b6d4", // cyan-500
  "#84cc16", // lime-500
  "#ec4899", // pink-500
];

export const GROUP_COLORS: Record<string, string> = {
  necessary: "#60a5fa",
  discretionary: "#a78bfa",
  anomalous: "#fbbf24",
  income: "#34d399",
};

export const GROUP_ORDER: string[] = [
  "income",
  "necessary",
  "discretionary",
  "anomalous",
];

export function getGroupLabel(group: string): string {
  switch (group) {
    case "income":
      return "Income";
    case "necessary":
      return "Necessary";
    case "discretionary":
      return "Discretionary";
    case "anomalous":
      return "Anomalous";
    default:
      return group;
  }
}

// Debt Trajectory uses its own three-state vocabulary — ahead / on track /
// behind — mapped to a green / blue / red palette so "on track" reads as its
// own good-but-not-ahead state rather than borrowing the target yellow.
export function getDebtStatusLabel(status: string): string {
  switch (status) {
    case "ahead":
      return "Ahead of plan";
    case "on_track":
      return "On track";
    case "behind":
      return "Behind plan";
    default:
      return "Unknown";
  }
}

export function getDebtStatusBgColor(status: string): string {
  switch (status) {
    case "ahead":
      return "bg-emerald-500";
    case "on_track":
      return "bg-sky-500";
    case "behind":
      return "bg-red-500";
    default:
      return "bg-gray-400";
  }
}

export function getDebtStatusTextColor(status: string): string {
  switch (status) {
    case "ahead":
      return "text-emerald-600 dark:text-emerald-400";
    case "on_track":
      return "text-sky-600 dark:text-sky-400";
    case "behind":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-muted-foreground";
  }
}

/** Hex for the debt-status lines/markers on charts. */
export const DEBT_STATUS_HEX: Record<string, string> = {
  ahead: "#10b981", // emerald-500
  on_track: "#0ea5e9", // sky-500
  behind: "#ef4444", // red-500
};

export function getStatusBorderColor(status: string): string {
  switch (status) {
    case "on_target":
      return "border-l-green-500";
    case "in_tolerance":
      return "border-l-yellow-500";
    case "off_target":
      return "border-l-red-500";
    default:
      return "border-l-gray-500";
  }
}
