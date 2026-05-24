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
