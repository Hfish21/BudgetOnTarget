"use client";

import { useEffect, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Category, HouseholdMember } from "@/types";

interface TransactionFiltersProps {
  onFilterChange: (filters: {
    category_id?: number;
    household_member_id?: number;
    search?: string;
    is_uncategorized?: boolean;
  }) => void;
  initialFilters?: {
    category_id?: number;
    household_member_id?: number;
    search?: string;
    is_uncategorized?: boolean;
  };
}

export function TransactionFilters({
  onFilterChange,
  initialFilters = {},
}: TransactionFiltersProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [categoryId, setCategoryId] = useState<number | undefined>(
    initialFilters.category_id
  );
  const [memberId, setMemberId] = useState<number | undefined>(
    initialFilters.household_member_id
  );
  const [search, setSearch] = useState(initialFilters.search || "");
  const [uncategorizedOnly, setUncategorizedOnly] = useState(
    initialFilters.is_uncategorized || false
  );

  useEffect(() => {
    Promise.all([api.categories.list(), api.householdMembers.list()])
      .then(([cats, mems]) => {
        setCategories(cats);
        setMembers(mems);
      })
      .catch(() => {
        /* filter data loading is non-critical */
      });
  }, []);

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      onFilterChange({
        category_id: categoryId,
        household_member_id: memberId,
        search: search || undefined,
        is_uncategorized: uncategorizedOnly || undefined,
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, categoryId, memberId, uncategorizedOnly, onFilterChange]);

  const handleClear = useCallback(() => {
    setCategoryId(undefined);
    setMemberId(undefined);
    setSearch("");
    setUncategorizedOnly(false);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative">
        <select
          value={categoryId ?? ""}
          onChange={(e) =>
            setCategoryId(e.target.value ? Number(e.target.value) : undefined)
          }
          className="h-8 rounded-lg border border-input bg-white px-3 pr-8 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      <div className="relative">
        <select
          value={memberId ?? ""}
          onChange={(e) =>
            setMemberId(e.target.value ? Number(e.target.value) : undefined)
          }
          className="h-8 rounded-lg border border-input bg-white px-3 pr-8 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Members</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <Input
        type="text"
        placeholder="Search transactions..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 w-56"
      />

      <Button
        variant={uncategorizedOnly ? "default" : "outline"}
        size="sm"
        onClick={() => setUncategorizedOnly(!uncategorizedOnly)}
      >
        Uncategorized Only
      </Button>

      {(categoryId || memberId || search || uncategorizedOnly) && (
        <Button variant="ghost" size="sm" onClick={handleClear}>
          Clear Filters
        </Button>
      )}
    </div>
  );
}
