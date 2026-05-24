"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Target, Category, HouseholdMember } from "@/types";

interface TargetFormProps {
  target?: Target | null;
  onSave: () => void;
  onCancel: () => void;
}

export function TargetForm({ target, onSave, onCancel }: TargetFormProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(target?.name || "");
  const [targetType, setTargetType] = useState<"monetary" | "count">(
    target?.target_type || "monetary"
  );
  const [direction, setDirection] = useState<"at_most" | "at_least" | "exactly">(
    target?.direction || "at_most"
  );
  const [valueDollars, setValueDollars] = useState(
    target ? (target.value / 100).toFixed(2) : ""
  );
  const [toleranceUpperDollars, setToleranceUpperDollars] = useState(
    target ? (target.tolerance_upper / 100).toFixed(2) : "0"
  );
  const [toleranceLowerDollars, setToleranceLowerDollars] = useState(
    target ? (target.tolerance_lower / 100).toFixed(2) : "0"
  );
  const [personScope, setPersonScope] = useState<string | null>(
    target?.person_scope || null
  );
  const [categoryId, setCategoryId] = useState<number | null>(
    target?.category_id || null
  );
  const [descriptionPattern, setDescriptionPattern] = useState(
    target?.description_pattern || ""
  );
  const [isActive, setIsActive] = useState(target?.is_active ?? true);

  useEffect(() => {
    Promise.all([api.categories.list(), api.householdMembers.list()])
      .then(([cats, mems]) => {
        setCategories(cats);
        setMembers(mems);
      })
      .catch(() => {
        /* non-critical */
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const isMonetary = targetType === "monetary";
    const value = isMonetary
      ? Math.round(parseFloat(valueDollars) * 100)
      : parseInt(valueDollars, 10);
    const toleranceUpper = isMonetary
      ? Math.round(parseFloat(toleranceUpperDollars) * 100)
      : parseInt(toleranceUpperDollars, 10) || 0;
    const toleranceLower = isMonetary
      ? Math.round(parseFloat(toleranceLowerDollars) * 100)
      : parseInt(toleranceLowerDollars, 10) || 0;

    const body = {
      name,
      target_type: targetType,
      direction,
      value,
      tolerance_upper: toleranceUpper,
      tolerance_lower: toleranceLower,
      period: "monthly",
      person_scope: personScope,
      category_id: categoryId,
      description_pattern: descriptionPattern || null,
      is_active: isActive,
    };

    try {
      if (target) {
        await api.targets.update(target.id, body);
      } else {
        await api.targets.create(body);
      }
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save target");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{target ? "Edit Target" : "Add Target"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Grocery Budget"
                required
              />
            </div>

            <div>
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as "monetary" | "count")}
                className="h-8 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="monetary">Monetary ($)</option>
                <option value="count">Count (#)</option>
              </select>
            </div>

            <div>
              <Label htmlFor="direction">Direction</Label>
              <select
                id="direction"
                value={direction}
                onChange={(e) => setDirection(e.target.value as "at_most" | "at_least" | "exactly")}
                className="h-8 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="at_most">At Most</option>
                <option value="at_least">At Least</option>
                <option value="exactly">Exactly</option>
              </select>
            </div>

            <div>
              <Label htmlFor="value">
                Value {targetType === "monetary" ? "($)" : "(#)"}
              </Label>
              <Input
                id="value"
                type="number"
                step={targetType === "monetary" ? "0.01" : "1"}
                value={valueDollars}
                onChange={(e) => setValueDollars(e.target.value)}
                placeholder={targetType === "monetary" ? "600.00" : "5"}
                required
              />
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={categoryId ?? ""}
                onChange={(e) =>
                  setCategoryId(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                className="h-8 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="toleranceUpper">
                Upper Tolerance {targetType === "monetary" ? "($)" : ""}
              </Label>
              <Input
                id="toleranceUpper"
                type="number"
                step={targetType === "monetary" ? "0.01" : "1"}
                value={toleranceUpperDollars}
                onChange={(e) => setToleranceUpperDollars(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="toleranceLower">
                Lower Tolerance {targetType === "monetary" ? "($)" : ""}
              </Label>
              <Input
                id="toleranceLower"
                type="number"
                step={targetType === "monetary" ? "0.01" : "1"}
                value={toleranceLowerDollars}
                onChange={(e) => setToleranceLowerDollars(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="person">Person Scope</Label>
              <select
                id="person"
                value={personScope ?? ""}
                onChange={(e) =>
                  setPersonScope(e.target.value || null)
                }
                className="h-8 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Household (all)</option>
                {members.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="pattern">Description Pattern</Label>
              <Input
                id="pattern"
                value={descriptionPattern}
                onChange={(e) => setDescriptionPattern(e.target.value)}
                placeholder="e.g., RURAL KING"
              />
            </div>

            <div className="col-span-2 flex items-center gap-2">
              <Switch
                id="active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="active">Active</Label>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : target ? "Update" : "Create"}
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
