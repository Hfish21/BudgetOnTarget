"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, User, PackageOpen } from "lucide-react";
import type { HouseholdMember } from "@/types";

export function MemberList() {
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      setMembers(await api.householdMembers.list());
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setError(null);
    try {
      await api.householdMembers.create({ name: newName.trim(), card_identifiers: "[]" });
      setNewName("");
      setAddOpen(false);
      fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    }
  };

  const COLORS = ["bg-blue-500/20 text-blue-400", "bg-violet-500/20 text-violet-400", "bg-emerald-500/20 text-emerald-400", "bg-amber-500/20 text-amber-400"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Household Members</h3>
          <p className="text-xs text-muted-foreground">
            People in the household. Card identifiers link transactions to members.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 size-3.5" />
          Add Member
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <PackageOpen className="mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No members yet</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Add household members to track spending per person.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member, i) => (
            <Card key={member.id}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${COLORS[i % COLORS.length]}`}>
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{member.name}</p>
                  <p className="text-[11px] text-muted-foreground">Household member</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Member</DialogTitle>
            <DialogDescription>
              Add a household member to track their spending separately.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <DialogFooter showCloseButton>
            <Button onClick={handleAdd} disabled={!newName.trim()}>Add Member</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
