"use client";

import { useState } from "react";
import { Lightbulb, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { feedbackTextareaClass } from "@/components/settings/feedback-shared";
import { newIssueUrl, openNewIssue, TITLE_MAX, TEXT_MAX } from "@/lib/github";

const ISSUE_TEMPLATE = "feature_request.yml";

// Options shown in the in-app picker. GitHub can't pre-fill a dropdown via
// query params, so the choice is folded into the proposal body instead.
const AREAS = [
  "Not sure / general",
  "Importing transactions",
  "Categories & rules",
  "Targets & budgets",
  "Monthly dashboard",
  "Trends",
  "Transactions view",
  "Settings & data",
  "Something else",
] as const;

export function FeatureRequest() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [area, setArea] = useState<string>(AREAS[0]);
  const [problem, setProblem] = useState("");
  const [proposal, setProposal] = useState("");

  const canSubmit = title.trim().length > 0 && proposal.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    // Area can't pre-fill a GitHub dropdown, so fold it into the body.
    const proposalWithArea = `${proposal.trim()}\n\n**Area:** ${area}`;
    const url = newIssueUrl(ISSUE_TEMPLATE, {
      title: `[Feature]: ${title.trim()}`.slice(0, TITLE_MAX + 11),
      problem: problem.trim(),
      proposal: proposalWithArea,
    });
    openNewIssue(url);
    setOpen(false);
    setTitle("");
    setArea(AREAS[0]);
    setProblem("");
    setProposal("");
  }

  return (
    <div className="rounded-xl border border-border p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Lightbulb className="size-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Have an idea?</h3>
          <p className="text-sm text-muted-foreground">
            Suggest a feature or improvement. Requests are tracked publicly on
            GitHub, so you&apos;ll need a free GitHub account to submit.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button variant="default" size="sm">
                <Lightbulb className="size-3.5" />
                Request a feature
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Request a feature</DialogTitle>
              <DialogDescription>
                Fill this in and we&apos;ll open a pre-filled issue on GitHub for
                you to submit. Please don&apos;t include real financial data —
                the issue is public.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="fr-title">
                  Summary <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="fr-title"
                  value={title}
                  maxLength={TITLE_MAX}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="One line: what do you want?"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fr-area">Area of the app</Label>
                <select
                  id="fr-area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                >
                  {AREAS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fr-problem">What problem does it solve?</Label>
                <textarea
                  id="fr-problem"
                  value={problem}
                  maxLength={TEXT_MAX}
                  onChange={(e) => setProblem(e.target.value)}
                  placeholder="What's frustrating or missing today? (optional)"
                  className={feedbackTextareaClass}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fr-proposal">
                  Describe the feature{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <textarea
                  id="fr-proposal"
                  value={proposal}
                  maxLength={TEXT_MAX}
                  onChange={(e) => setProposal(e.target.value)}
                  placeholder="What would you like BudgetOnTarget to do?"
                  className={feedbackTextareaClass}
                />
              </div>
            </div>

            <DialogFooter showCloseButton>
              <Button
                variant="default"
                disabled={!canSubmit}
                onClick={handleSubmit}
              >
                Continue on GitHub
                <ExternalLink className="size-3.5" />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
