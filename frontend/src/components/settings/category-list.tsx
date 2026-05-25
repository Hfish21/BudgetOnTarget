"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";
import type { Category } from "@/types";

export function CategoryList() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.categories.list();
      setCategories(data);
    } catch {
      /* non-critical */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setError(null);
    try {
      await api.categories.create({ name: newName.trim() });
      setNewName("");
      fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add category");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this category?")) return;
    try {
      await api.categories.delete(id);
      fetchCategories();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete category"
      );
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name..."
          className="max-w-xs"
        />
        <Button type="submit" size="sm">
          <Plus className="mr-1 size-3.5" />
          Add
        </Button>
      </form>

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
      ) : categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No categories yet.</p>
      ) : (
        <div className="space-y-1">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center justify-between rounded-lg bg-card px-3 py-2 ring-1 ring-border"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{cat.name}</span>
                <span className="text-xs text-muted-foreground">
                  {cat.transaction_count} transactions
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleDelete(cat.id)}
              >
                <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
