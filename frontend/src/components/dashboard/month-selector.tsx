"use client";

import { useMonth } from "@/hooks/use-month";
import { Calendar } from "lucide-react";

export function MonthSelector() {
  const { months, selectedYear, selectedMonth, setMonth, loading } =
    useMonth();

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2">
        <Calendar className="size-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (months.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2">
        <Calendar className="size-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">No data yet</span>
      </div>
    );
  }

  const currentValue =
    selectedYear && selectedMonth
      ? `${selectedYear}-${selectedMonth}`
      : "";

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <Calendar className="size-4 text-muted-foreground" />
      </div>
      <select
        value={currentValue}
        onChange={(e) => {
          const [year, month] = e.target.value.split("-").map(Number);
          setMonth(year, month);
        }}
        className="w-full appearance-none rounded-lg bg-accent py-2 pl-9 pr-8 text-sm text-foreground outline-none transition-colors hover:bg-accent/80 focus:bg-accent/80"
      >
        {months.map((m) => (
          <option
            key={`${m.year}-${m.month}`}
            value={`${m.year}-${m.month}`}
            className="bg-card text-foreground"
          >
            {m.label} ({m.transaction_count})
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
        <svg
          className="size-4 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </div>
  );
}
