"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import type { Account } from "@/types";

export function AccountList() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New account form
  const [newName, setNewName] = useState("");
  const [newInstitution, setNewInstitution] = useState("");
  const [newType, setNewType] = useState("checking");

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.accounts.list();
      setAccounts(data);
    } catch {
      /* non-critical */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newInstitution.trim()) return;

    setError(null);
    try {
      await api.accounts.create({
        name: newName.trim(),
        institution: newInstitution.trim(),
        account_type: newType,
      });
      setNewName("");
      setNewInstitution("");
      setNewType("checking");
      fetchAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add account");
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex flex-wrap gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Account name..."
          className="w-48"
        />
        <Input
          value={newInstitution}
          onChange={(e) => setNewInstitution(e.target.value)}
          placeholder="Institution..."
          className="w-40"
        />
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
          className="h-8 rounded-lg border border-input bg-white px-2 text-sm"
        >
          <option value="checking">Checking</option>
          <option value="credit">Credit</option>
          <option value="savings">Savings</option>
        </select>
        <Button type="submit" size="sm">
          <Plus className="mr-1 size-3.5" />
          Add
        </Button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded bg-gray-200"
            />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No accounts yet.</p>
      ) : (
        <div className="space-y-1">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-gray-100"
            >
              <span className="text-sm font-medium">{acc.name}</span>
              <span className="text-xs text-muted-foreground">
                {acc.institution}
              </span>
              <Badge variant="secondary" className="text-xs">
                {acc.account_type}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
