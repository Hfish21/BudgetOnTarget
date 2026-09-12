"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useStorage } from "@/components/storage-provider";
import type { MonthInfo } from "@/types";

export function useMonth() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { dataVersion } = useStorage();
  const [months, setMonths] = useState<MonthInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");

  // Refetching on dataVersion must not blank the list: this hook runs in every
  // mounted MonthSelector, and flipping back to `loading` swaps the <select>
  // for a placeholder mid-interaction, which can swallow the user's click.
  // Only the very first load shows a loading state.
  useEffect(() => {
    let cancelled = false;
    api.transactions
      .getMonths()
      .then((data) => {
        if (cancelled) return;
        setMonths(data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Failed to load months");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dataVersion]);

  // Default to the most recent month when the URL names none.
  //
  // Sidebar and MobileChrome are both mounted at all times (each hidden at the
  // other's breakpoint by CSS), so two copies of this hook run concurrently
  // with independently-timed state. Guarding on the `yearParam` snapshot alone
  // is not enough: the instance that has not yet re-rendered still sees `null`
  // and will `router.replace` over a month the user just chose in the other.
  //
  // So consult the live URL rather than this render's snapshot, and default at
  // most once per mount.
  const didDefault = useRef(false);
  useEffect(() => {
    if (didDefault.current) return;

    if (yearParam || monthParam) {
      didDefault.current = true;
      return;
    }
    if (months.length === 0) return;

    // The committed snapshot can lag a sibling's navigation; the address bar
    // cannot.
    const live = new URLSearchParams(window.location.search);
    if (live.get("year") || live.get("month")) {
      didDefault.current = true;
      return;
    }

    didDefault.current = true;
    const latest = months[0];
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(latest.year));
    params.set("month", String(latest.month));
    router.replace(`${pathname}?${params.toString()}`);
  }, [months, yearParam, monthParam, router, pathname, searchParams]);

  const selectedYear = yearParam ? parseInt(yearParam, 10) : null;
  const selectedMonth = monthParam ? parseInt(monthParam, 10) : null;

  const setMonth = useCallback(
    (year: number, month: number) => {
      // An explicit choice outranks the default, so make sure a default that
      // has not run yet never fires and overwrites it.
      didDefault.current = true;
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
