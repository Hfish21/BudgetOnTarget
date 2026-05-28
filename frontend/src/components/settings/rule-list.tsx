"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, Plus, RefreshCw, ListFilter, PackageOpen } from "lucide-react";
import type { CategoryRule, Category } from "@/types";

export function RuleList() {
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recategorizing, setRecategorizing] = useState(false);
  const [recategorizeResult, setRecategorizeResult] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CategoryRule | null>(null);

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

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async () => {
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
      setNewCategoryId(null);
      setAddOpen(false);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add rule");
    }
  };

  const handleToggle = async (rule: CategoryRule) => {
    try {
      await api.categoryRules.update(rule.id, { is_active: !rule.is_active });
      fetchData();
    } catch { /* non-critical */ }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.categoryRules.delete(deleteTarget.id);
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete rule");
    }
  };

  const handleRecategorize = async () => {
    setRecategorizing(true);
    setRecategorizeResult(null);
    try {
      const result = await api.categoryRules.recategorize();
      setRecategorizeResult(result.updated_count);
      setTimeout(() => setRecategorizeResult(null), 4000);
    } catch { /* non-critical */ }
    finally { setRecategorizing(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Category Rules</h3>
          <p className="text-xs text-muted-foreground">
            Auto-categorize transactions by matching description patterns.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecategorize}
            disabled={recategorizing}
          >
            <RefreshCw className={`mr-1.5 size-3.5 ${recategorizing ? "animate-spin" : ""}`} />
            {recategorizeResult !== null ? `${recategorizeResult} updated` : "Re-categorize All"}
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 size-3.5" />
            Add Rule
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <PackageOpen className="mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No rules yet</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Rules auto-categorize transactions based on description patterns.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                <th className="text-left py-2 px-3 font-medium text-xs w-16">Priority</th>
                <th className="text-left py-2 px-3 font-medium text-xs">Pattern</th>
                <th className="text-left py-2 px-3 font-medium text-xs w-24">Type</th>
                <th className="text-left py-2 px-3 font-medium text-xs">Category</th>
                <th className="text-center py-2 px-3 font-medium text-xs w-16">Active</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr
                  key={rule.id}
                  className={`border-b border-border/50 last:border-0 transition-colors hover:bg-muted/30 ${!rule.is_active ? "opacity-40" : ""}`}
                >
                  <td className="py-2 px-3 tabular-nums text-muted-foreground text-xs">
                    #{rule.priority}
                  </td>
                  <td className="py-2 px-3">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                      {rule.pattern}
                    </code>
                  </td>
                  <td className="py-2 px-3">
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {rule.match_type}
                    </Badge>
                  </td>
                  <td className="py-2 px-3 text-xs">{rule.category_name}</td>
                  <td className="py-2 px-3 text-center">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={() => handleToggle(rule)}
                    />
                  </td>
                  <td className="py-2 px-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setDeleteTarget(rule)}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add rule dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Rule</DialogTitle>
            <DialogDescription>
              Create a rule to auto-categorize transactions whose description matches a pattern.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Pattern</label>
              <Input
                value={newPattern}
                onChange={(e) => setNewPattern(e.target.value)}
                placeholder="e.g. STARBUCKS, HOME DEPOT"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Match Type</label>
                <select
                  value={newMatchType}
                  onChange={(e) => setNewMatchType(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="substring">Substring</option>
                  <option value="regex">Regex</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Priority</label>
                <Input
                  type="number"
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  placeholder="100"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
              <select
                value={newCategoryId ?? ""}
                onChange={(e) => setNewCategoryId(e.target.value ? Number(e.target.value) : null)}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Select a category...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter showCloseButton>
            <Button onClick={handleAdd} disabled={!newPattern.trim() || !newCategoryId}>
              Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Rule</DialogTitle>
            <DialogDescription>
              Delete the rule matching &ldquo;{deleteTarget?.pattern}&rdquo;?
              Existing categorizations won&apos;t change.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
