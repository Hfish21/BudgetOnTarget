"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, RefreshCw } from "lucide-react";
import type { CategoryRule, Category } from "@/types";

export function RuleList() {
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recategorizing, setRecategorizing] = useState(false);

  // New rule form state
  const [newPattern, setNewPattern] = useState("");
  const [newMatchType, setNewMatchType] = useState("substring");
  const [newCategoryId, setNewCategoryId] = useState<number | null>(null);
  const [newPriority, setNewPriority] = useState("100");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ruleData, catData] = await Promise.all([
        api.categoryRules.list(),
        api.categories.list(),
      ]);
      setRules(ruleData);
      setCategories(catData);
    } catch {
      /* non-critical */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPattern.trim() || !newCategoryId) return;

    setError(null);
    try {
      await api.categoryRules.create({
        pattern: newPattern.trim(),
        match_type: newMatchType,
        category_id: newCategoryId,
        priority: parseInt(newPriority, 10) || 100,
      });
      setNewPattern("");
      setNewPriority("100");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add rule");
    }
  };

  const handleToggle = async (rule: CategoryRule) => {
    try {
      await api.categoryRules.update(rule.id, {
        is_active: !rule.is_active,
      });
      fetchData();
    } catch {
      /* non-critical */
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this rule?")) return;
    try {
      await api.categoryRules.delete(id);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete rule");
    }
  };

  const handleRecategorize = async () => {
    setRecategorizing(true);
    try {
      const result = await api.categoryRules.recategorize();
      alert(`Recategorized ${result.updated_count} transactions.`);
    } catch {
      /* non-critical */
    } finally {
      setRecategorizing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <form onSubmit={handleAdd} className="flex flex-wrap gap-2">
          <Input
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
            placeholder="Pattern..."
            className="w-40"
          />
          <select
            value={newMatchType}
            onChange={(e) => setNewMatchType(e.target.value)}
            className="h-8 rounded-lg border border-input bg-card px-2 text-sm"
          >
            <option value="substring">Substring</option>
            <option value="regex">Regex</option>
          </select>
          <select
            value={newCategoryId ?? ""}
            onChange={(e) =>
              setNewCategoryId(
                e.target.value ? Number(e.target.value) : null
              )
            }
            className="h-8 rounded-lg border border-input bg-card px-2 text-sm"
          >
            <option value="">Category...</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <Input
            type="number"
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value)}
            className="w-20"
            placeholder="Priority"
          />
          <Button type="submit" size="sm">
            <Plus className="mr-1 size-3.5" />
            Add
          </Button>
        </form>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRecategorize}
          disabled={recategorizing}
        >
          <RefreshCw
            className={`mr-1 size-3.5 ${recategorizing ? "animate-spin" : ""}`}
          />
          Re-categorize All
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded bg-muted"
            />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No category rules yet.
        </p>
      ) : (
        <div className="space-y-1">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between rounded-lg bg-card px-3 py-2 ring-1 ring-border"
            >
              <div className="flex items-center gap-3">
                <span className="w-12 text-xs text-muted-foreground tabular-nums">
                  #{rule.priority}
                </span>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  {rule.pattern}
                </code>
                <Badge variant="secondary" className="text-xs">
                  {rule.match_type}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {rule.category_name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={rule.is_active}
                  onCheckedChange={() => handleToggle(rule)}
                />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleDelete(rule.id)}
                >
                  <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
