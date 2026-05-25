"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import type { HouseholdMember } from "@/types";

export function MemberList() {
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.householdMembers.list();
      setMembers(data);
    } catch {
      /* non-critical */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setError(null);
    try {
      await api.householdMembers.create({
        name: newName.trim(),
        card_identifiers: "[]",
      });
      setNewName("");
      fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Member name..."
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
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded bg-muted"
            />
          ))}
        </div>
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No household members yet.
        </p>
      ) : (
        <div className="space-y-1">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center rounded-lg bg-card px-3 py-2 ring-1 ring-border"
            >
              <span className="text-sm font-medium">{member.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
