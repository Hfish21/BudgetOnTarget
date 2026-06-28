"use client";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { formatCents, getGroupLabel } from "@/lib/utils";
import type { WizardTargetDraft } from "../wizard-context";

interface TargetSuggestionCardProps {
  draft: WizardTargetDraft;
  onUpdate: (updates: Partial<WizardTargetDraft>) => void;
}

export function TargetSuggestionCard({
  draft,
  onUpdate,
}: TargetSuggestionCardProps) {
  const directionLabel =
    draft.direction === "at_most"
      ? "at most"
      : draft.direction === "at_least"
        ? "at least"
        : "exactly";

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border p-3">
      <Switch
        checked={draft.enabled}
        onCheckedChange={(checked) => onUpdate({ enabled: checked })}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {draft.categoryName}
          </span>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {getGroupLabel(draft.spendGroup)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Avg spending: {formatCents(draft.suggestedAmountCents)} / month &middot;{" "}
          {directionLabel}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs text-muted-foreground">$</span>
        <Input
          type="number"
          value={(draft.userAmountCents / 100).toFixed(0)}
          onChange={(e) => {
            const cents = Math.round(parseFloat(e.target.value || "0") * 100);
            onUpdate({ userAmountCents: cents });
          }}
          className="h-8 w-24 text-sm text-right"
          disabled={!draft.enabled}
        />
      </div>
    </div>
  );
}
