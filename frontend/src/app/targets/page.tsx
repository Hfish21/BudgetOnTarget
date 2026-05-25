"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { TargetForm } from "@/components/targets/target-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { getDirectionLabel } from "@/lib/utils";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Target } from "@/types";

export default function TargetsPage() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState<Target | null>(null);

  const fetchTargets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.targets.list();
      setTargets(data);
    } catch {
      /* non-critical */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets]);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this target?")) return;
    try {
      await api.targets.delete(id);
      fetchTargets();
    } catch {
      // Failed to delete
    }
  };

  const handleSave = () => {
    setShowForm(false);
    setEditingTarget(null);
    fetchTargets();
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingTarget(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Targets</h2>
          <p className="text-sm text-muted-foreground">
            Configure spending and income targets for your budget.
          </p>
        </div>
        {!showForm && !editingTarget && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-1 size-4" />
            Add Target
          </Button>
        )}
      </div>

      {(showForm || editingTarget) && (
        <TargetForm
          target={editingTarget}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl bg-muted"
            />
          ))}
        </div>
      ) : targets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No targets configured yet. Click &ldquo;Add Target&rdquo; to create
            your first budget target.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {targets.map((target) => (
            <Card key={target.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">{target.name}</CardTitle>
                  {!target.is_active && (
                    <Badge
                      variant="outline"
                      className="text-xs text-muted-foreground"
                    >
                      Inactive
                    </Badge>
                  )}
                </div>
                <CardAction>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditingTarget(target);
                        setShowForm(false);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(target.id)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>
                    {target.target_type === "monetary"
                      ? target.value_display
                      : target.value}{" "}
                    ({getDirectionLabel(target.direction)})
                  </span>
                  {target.category_name && (
                    <span>Category: {target.category_name}</span>
                  )}
                  {target.person_scope && (
                    <span>Person: {target.person_scope}</span>
                  )}
                  {target.description_pattern && (
                    <span>
                      Pattern: &ldquo;{target.description_pattern}&rdquo;
                    </span>
                  )}
                  {(target.tolerance_upper > 0 ||
                    target.tolerance_lower > 0) && (
                    <span>
                      Tolerance: -{target.tolerance_lower_display} / +
                      {target.tolerance_upper_display}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
