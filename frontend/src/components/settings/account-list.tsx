"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, CreditCard, Landmark, PiggyBank, PackageOpen } from "lucide-react";
import type { Account } from "@/types";

const TYPE_CONFIG: Record<string, { icon: typeof CreditCard; label: string; color: string }> = {
  checking: { icon: Landmark, label: "Checking", color: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  credit: { icon: CreditCard, label: "Credit", color: "bg-violet-500/15 text-violet-400 border-violet-500/20" },
  savings: { icon: PiggyBank, label: "Savings", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
};

export function AccountList() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newInstitution, setNewInstitution] = useState("");
  const [newType, setNewType] = useState("checking");

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      setAccounts(await api.accounts.list());
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const handleAdd = async () => {
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
      setAddOpen(false);
      fetchAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add account");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Accounts</h3>
          <p className="text-xs text-muted-foreground">
            Bank and credit card accounts linked to CSV imports.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 size-3.5" />
          Add Account
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <PackageOpen className="mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No accounts yet</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Add a bank or credit card account to import transactions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {accounts.map((acc) => {
            const config = TYPE_CONFIG[acc.account_type] ?? TYPE_CONFIG.checking;
            const Icon = config.icon;
            return (
              <Card key={acc.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${config.color.split(" ").slice(0, 1).join(" ")}`}>
                    <Icon className={`size-4.5 ${config.color.split(" ").slice(1, 2).join(" ")}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{acc.name}</p>
                    <p className="text-[11px] text-muted-foreground">{acc.institution}</p>
                  </div>
                  <Badge variant="secondary" className={`shrink-0 text-[10px] font-normal border ${config.color}`}>
                    {config.label}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Account</DialogTitle>
            <DialogDescription>
              Add a bank or credit card account for CSV imports.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Account Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Main Checking, Rewards Visa"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Institution</label>
              <Input
                value={newInstitution}
                onChange={(e) => setNewInstitution(e.target.value)}
                placeholder="e.g. USAA, Chase"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Account Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="checking">Checking</option>
                <option value="credit">Credit Card</option>
                <option value="savings">Savings</option>
              </select>
            </div>
          </div>
          <DialogFooter showCloseButton>
            <Button onClick={handleAdd} disabled={!newName.trim() || !newInstitution.trim()}>
              Add Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
