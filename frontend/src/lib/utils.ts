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

export function getStatusColor(status: string): string {
  switch (status) {
    case "on_target":
      return "text-green-600";
    case "in_tolerance":
      return "text-yellow-600";
    case "off_target":
      return "text-red-600";
    default:
      return "text-gray-600";
  }
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

export function deriveGroupStatus(
  statuses: string[]
): "on_target" | "in_tolerance" | "off_target" {
  if (statuses.length === 0) return "on_target";
  if (statuses.some((s) => s === "off_target")) return "off_target";
  if (statuses.some((s) => s === "in_tolerance")) return "in_tolerance";
  return "on_target";
}

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
