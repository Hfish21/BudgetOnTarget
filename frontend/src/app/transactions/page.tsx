"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Transaction } from "@/types";

const PAGE_SIZE = 100;

function TransactionsContent() {
  const searchParams = useSearchParams();
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, string | number | boolean | undefined>>({});

  const fetchTransactions = useCallback(
    (currentOffset: number, currentFilters: Record<string, string | number | boolean | undefined>) => {
      if (!year || !month) return;

      setLoading(true);
      setError(null);

      api.transactions
        .list({
          year: parseInt(year, 10),
          month: parseInt(month, 10),
          limit: PAGE_SIZE,
          offset: currentOffset,
          ...currentFilters,
        })
        .then((data) => {
          setTransactions(data.transactions);
          setTotalCount(data.total_count);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message || "Failed to load transactions");
          setLoading(false);
        });
    },
    [year, month]
  );

  useEffect(() => {
    setOffset(0);
    fetchTransactions(0, filters);
  }, [year, month, filters, fetchTransactions]);

  const handleFilterChange = useCallback(
    (newFilters: {
      category_id?: number;
      household_member_id?: number;
      search?: string;
      is_uncategorized?: boolean;
    }) => {
      setOffset(0);
      setFilters(newFilters as Record<string, string | number | boolean | undefined>);
    },
    []
  );

  const handleCategorize = useCallback(
    async (transactionId: number, categoryId: number) => {
      try {
        await api.transactions.categorize(transactionId, {
          category_id: categoryId,
        });
        fetchTransactions(offset, filters);
      } catch {
        // Failed to categorize - we still re-fetch to show current state
        fetchTransactions(offset, filters);
      }
    },
    [offset, filters, fetchTransactions]
  );

  const handlePrevPage = () => {
    const newOffset = Math.max(0, offset - PAGE_SIZE);
    setOffset(newOffset);
    fetchTransactions(newOffset, filters);
  };

  const handleNextPage = () => {
    const newOffset = offset + PAGE_SIZE;
    if (newOffset < totalCount) {
      setOffset(newOffset);
      fetchTransactions(newOffset, filters);
    }
  };

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (!year || !month) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Select a month from the sidebar to view transactions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Transactions</h2>
        <p className="text-sm text-muted-foreground">
          {totalCount} transactions
        </p>
      </div>

      <TransactionFilters onFilterChange={handleFilterChange} />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">
            Failed to load transactions: {error}
          </p>
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded bg-gray-200"
            />
          ))}
        </div>
      ) : (
        <>
          <TransactionTable
            transactions={transactions}
            onCategorize={handleCategorize}
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Showing {offset + 1}-
                {Math.min(offset + PAGE_SIZE, totalCount)} of {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={offset === 0}
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={offset + PAGE_SIZE >= totalCount}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <TransactionsContent />
    </Suspense>
  );
}
