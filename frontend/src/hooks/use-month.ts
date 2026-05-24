"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { MonthInfo } from "@/types";

export function useMonth() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [months, setMonths] = useState<MonthInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");

  useEffect(() => {
    api.transactions
      .getMonths()
      .then((data) => {
        setMonths(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load months");
        setLoading(false);
      });
  }, []);

  // If no month selected in URL and we have months data, default to the most recent
  useEffect(() => {
    if (!yearParam && !monthParam && months.length > 0) {
      const latest = months[0];
      const params = new URLSearchParams(searchParams.toString());
      params.set("year", String(latest.year));
      params.set("month", String(latest.month));
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [months, yearParam, monthParam, router, pathname, searchParams]);

  const selectedYear = yearParam ? parseInt(yearParam, 10) : null;
  const selectedMonth = monthParam ? parseInt(monthParam, 10) : null;

  const setMonth = useCallback(
    (year: number, month: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("year", String(year));
      params.set("month", String(month));
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return {
    months,
    selectedYear,
    selectedMonth,
    setMonth,
    loading,
    error,
  };
}
