"use client";

import { useEffect, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Category, HouseholdMember, SpendGroup, Target } from "@/types";

const LANE_OPTIONS: { value: SpendGroup; label: string }[] = [
  { value: "income", label: "Income" },
  { value: "necessary", label: "Necessary" },
  { value: "discretionary", label: "Discretionary" },
  { value: "anomalous", label: "Anomalous" },
];

interface TransactionFiltersProps {
  onFilterChange: (filters: {
    category_id?: number;
    household_member_id?: number;
    search?: string;
    is_uncategorized?: boolean;
    lane?: SpendGroup;
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
  const [targets, setTargets] = useState<Target[]>([]);
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
  const [lane, setLane] = useState<SpendGroup | undefined>(undefined);

  useEffect(() => {
    Promise.all([
      api.categories.list(),
      api.householdMembers.list(),
      api.targets.list(),
    ])
      .then(([cats, mems, tgts]) => {
        setCategories(cats);
        setMembers(mems);
        setTargets(tgts);
      })
      .catch(() => {});
  }, []);

  // Filter categories by lane when a lane is selected
  const filteredCategories = lane
    ? (() => {
        const laneCatIds = new Set(
          targets
            .filter((t) => t.spend_group === lane && t.category_id !== null)
            .map((t) => t.category_id!)
        );
        return categories.filter((c) => laneCatIds.has(c.id));
      })()
    : categories;

  useEffect(() => {
    const timeout = setTimeout(() => {
      onFilterChange({
        category_id: categoryId,
        household_member_id: memberId,
        search: search || undefined,
        is_uncategorized: uncategorizedOnly || undefined,
        lane,
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, categoryId, memberId, uncategorizedOnly, lane, onFilterChange]);

  const handleClear = useCallback(() => {
    setCategoryId(undefined);
    setMemberId(undefined);
    setSearch("");
    setUncategorizedOnly(false);
    setLane(undefined);
  }, []);

  const selectClass =
    "h-8 rounded-lg border border-input bg-card px-3 pr-8 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

  const hasFilters = categoryId || memberId || search || uncategorizedOnly || lane;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={lane ?? ""}
        onChange={(e) => {
          const val = e.target.value as SpendGroup | "";
          setLane(val || undefined);
          setCategoryId(undefined);
        }}
        className={selectClass}
      >
        <option value="">All Lanes</option>
        {LANE_OPTIONS.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>

      <select
        value={categoryId ?? ""}
        onChange={(e) =>
          setCategoryId(e.target.value ? Number(e.target.value) : undefined)
        }
        className={selectClass}
      >
        <option value="">All Categories</option>
        {filteredCategories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>

      <select
        value={memberId ?? ""}
        onChange={(e) =>
          setMemberId(e.target.value ? Number(e.target.value) : undefined)
        }
        className={selectClass}
      >
        <option value="">All Members</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>

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

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={handleClear}>
          Clear
        </Button>
      )}
    </div>
  );
}
