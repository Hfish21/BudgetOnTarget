"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import type { Debt, Category, Account } from "@/types";

interface DebtFormProps {
  debt?: Debt | null;
  onSave: () => void;
  onCancel: () => void;
}

export function DebtForm({ debt, onSave, onCancel }: DebtFormProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(debt?.name || "");
  const [accountId, setAccountId] = useState<number | null>(
    debt?.account_id ?? null
  );
  const [anchorDate, setAnchorDate] = useState(
    debt?.anchor_date || new Date().toISOString().slice(0, 10)
  );
  const [anchorBalance, setAnchorBalance] = useState(
    debt ? (debt.anchor_balance_cents / 100).toFixed(2) : ""
  );
  const [aprPercent, setAprPercent] = useState(
    debt ? String(debt.apr_percent) : ""
  );
  const [minPayment, setMinPayment] = useState(
    debt ? (debt.min_payment_cents / 100).toFixed(2) : ""
  );
  const [extraPayment, setExtraPayment] = useState(
    debt ? (debt.extra_payment_cents / 100).toFixed(2) : "0"
  );
  const [paymentCategoryIds, setPaymentCategoryIds] = useState<number[]>(
    debt?.payment_category_ids ?? []
  );
  const [isActive, setIsActive] = useState(debt?.is_active ?? true);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  const loadOptions = () => {
    Promise.all([api.categories.list(), api.accounts.list()])
      .then(([cats, accts]) => {
        setCategories(cats);
        setAccounts(accts);
      })
      .catch(() => {
        /* non-critical */
      });
  };

  useEffect(loadOptions, []);

  const toggleCategory = (id: number) => {
    setPaymentCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleCreateCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    setCreatingCategory(true);
    setError(null);
    try {
      const cat = await api.categories.create({ name: trimmed });
      setNewCategoryName("");
      const cats = await api.categories.list();
      setCategories(cats);
      setPaymentCategoryIds((prev) => [...prev, cat.id]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const body = {
      name,
      account_id: accountId,
      anchor_date: anchorDate,
      anchor_balance_cents: Math.round(parseFloat(anchorBalance) * 100),
      apr_bps: Math.round(parseFloat(aprPercent) * 100),
      min_payment_cents: Math.round(parseFloat(minPayment) * 100),
      extra_payment_cents: Math.round(parseFloat(extraPayment || "0") * 100),
      payment_category_ids: paymentCategoryIds,
      is_active: isActive,
    };

    try {
      if (debt) {
        await api.debts.update(debt.id, body);
      } else {
        await api.debts.create(body);
      }
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save card");
    } finally {
      setSaving(false);
    }
  };

  const creditAccounts = accounts.filter((a) => a.account_type === "credit");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{debt ? "Edit Card" : "Add Card"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Card name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Chase Sapphire"
                required
              />
            </div>

            <div>
              <Label htmlFor="account">Linked account (optional)</Label>
              <select
                id="account"
                value={accountId ?? ""}
                onChange={(e) =>
                  setAccountId(e.target.value ? Number(e.target.value) : null)
                }
                className="h-8 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">None</option>
                {creditAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-6 sm:col-span-1">
              <Switch
                id="active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="active">Active</Label>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="mb-1 text-sm font-medium">Statement anchor</p>
            <p className="mb-3 text-xs text-muted-foreground">
              We don&rsquo;t read statements. Enter the balance and date from one
              recent statement; we project the payoff of that balance forward.
              New purchases on the card aren&rsquo;t tracked — re-anchor from a
              fresh statement anytime the estimate drifts.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="anchorDate">Statement date</Label>
                <Input
                  id="anchorDate"
                  type="date"
                  value={anchorDate}
                  onChange={(e) => setAnchorDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="anchorBalance">Balance owed ($)</Label>
                <Input
                  id="anchorBalance"
                  type="number"
                  step="0.01"
                  min="0"
                  value={anchorBalance}
                  onChange={(e) => setAnchorBalance(e.target.value)}
                  placeholder="5000.00"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="apr">APR (%)</Label>
              <Input
                id="apr"
                type="number"
                step="0.01"
                min="0"
                value={aprPercent}
                onChange={(e) => setAprPercent(e.target.value)}
                placeholder="24.99"
                required
              />
            </div>
            <div>
              <Label htmlFor="minPayment">Min. payment ($/mo)</Label>
              <Input
                id="minPayment"
                type="number"
                step="0.01"
                min="0"
                value={minPayment}
                onChange={(e) => setMinPayment(e.target.value)}
                placeholder="150.00"
                required
              />
            </div>
            <div>
              <Label htmlFor="extraPayment">Extra ($/mo)</Label>
              <Input
                id="extraPayment"
                type="number"
                step="0.01"
                min="0"
                value={extraPayment}
                onChange={(e) => setExtraPayment(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Your &ldquo;on track&rdquo; plan is the minimum plus the extra, every
            month.
          </p>

          <div>
            <Label>Which categories are payments toward this card?</Label>
            <p className="mb-2 text-xs text-muted-foreground">
              Transactions in these categories (on or after the statement date)
              count as payments. A card usually has its own dedicated payment
              category.
            </p>
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No categories yet — create one below.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const selected = paymentCategoryIds.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                        selected
                          ? "border-transparent bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="New category name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateCategory();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleCreateCategory}
                disabled={creatingCategory || !newCategoryName.trim()}
              >
                <Plus className="mr-1 size-4" />
                Add
              </Button>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : debt ? "Update" : "Create"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
