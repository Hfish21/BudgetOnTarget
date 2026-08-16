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
import { cn } from "@/lib/utils";

/**
 * Feature requests are filed as GitHub Issues. This app is a static, offline
 * PWA with no backend and no secrets, so we can't write to GitHub ourselves —
 * instead we hand the user off to GitHub's own "new issue" page with the form
 * pre-filled. They submit it under their own GitHub account, which lands the
 * request in our triage queue (label: feature-request) and doubles as a spam
 * gate. Nothing is sent anywhere from the app itself.
 */
const REPO = "Hfish21/BudgetOnTarget";
const ISSUE_TEMPLATE = "feature_request.yml";

// Must match the dropdown options in .github/ISSUE_TEMPLATE/feature_request.yml
// exactly, so GitHub pre-selects the chosen value.
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

const TITLE_MAX = 120;
const TEXT_MAX = 2000;

function buildIssueUrl(fields: {
  title: string;
  area: string;
  problem: string;
  proposal: string;
}): string {
  const params = new URLSearchParams({
    template: ISSUE_TEMPLATE,
    // Issue-form fields pre-fill via query params keyed by the field `id`.
    title: `[Feature]: ${fields.title}`.slice(0, TITLE_MAX + 11),
    area: fields.area,
    problem: fields.problem,
    proposal: fields.proposal,
  });
  return `https://github.com/${REPO}/issues/new?${params.toString()}`;
}

export function FeatureRequest() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [area, setArea] = useState<string>(AREAS[0]);
  const [problem, setProblem] = useState("");
  const [proposal, setProposal] = useState("");

  const canSubmit = title.trim().length > 0 && proposal.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    const url = buildIssueUrl({
      title: title.trim(),
      area,
      problem: problem.trim(),
      proposal: proposal.trim(),
    });
    // Open GitHub's pre-filled issue form in a new tab; the user submits there.
    window.open(url, "_blank", "noopener,noreferrer");
    setOpen(false);
    // Reset so the next request starts clean.
    setTitle("");
    setArea(AREAS[0]);
    setProblem("");
    setProposal("");
  }

  const textareaClass =
    "w-full min-h-20 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 resize-y";

  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-xl border border-border p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Lightbulb className="size-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Have an idea?</h3>
            <p className="text-sm text-muted-foreground">
              Suggest a feature or improvement. Requests are tracked publicly on
              GitHub, so you&apos;ll need a free GitHub account to submit — this
              keeps the queue spam-free.
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
                  Fill this in and we&apos;ll open a pre-filled issue on GitHub
                  for you to submit. Please don&apos;t include real financial
                  data — the issue is public.
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
                    className={textareaClass}
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
                    className={textareaClass}
                  />
                </div>
              </div>

              <DialogFooter showCloseButton>
                <Button
                  variant="default"
                  disabled={!canSubmit}
                  onClick={handleSubmit}
                  className={cn(!canSubmit && "opacity-50")}
                >
                  Continue on GitHub
                  <ExternalLink className="size-3.5" />
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <p className="px-1 text-xs text-muted-foreground">
        Prefer to browse or comment on existing ideas?{" "}
        <a
          href={`https://github.com/${REPO}/issues?q=is%3Aissue+label%3Afeature-request`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          See all feature requests on GitHub
        </a>
        .
      </p>
    </div>
  );
}
