"use client";

import { useState } from "react";
import { Bug, ExternalLink } from "lucide-react";
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

const ISSUE_TEMPLATE = "bug_report.yml";

/** Best-effort browser/OS string to help with debugging. No personal data. */
function environmentInfo(): string {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent;
}

export function BugReport() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [what, setWhat] = useState("");
  const [steps, setSteps] = useState("");
  const [expected, setExpected] = useState("");

  const canSubmit = title.trim().length > 0 && what.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    const url = newIssueUrl(ISSUE_TEMPLATE, {
      title: `[Bug]: ${title.trim()}`.slice(0, TITLE_MAX + 7),
      what: what.trim(),
      steps: steps.trim(),
      expected: expected.trim(),
      // Auto-captured so reporters don't have to know their browser version.
      environment: environmentInfo().slice(0, TEXT_MAX),
    });
    openNewIssue(url);
    setOpen(false);
    setTitle("");
    setWhat("");
    setSteps("");
    setExpected("");
  }

  return (
    <div className="rounded-xl border border-border p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <Bug className="size-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Something broken?</h3>
          <p className="text-sm text-muted-foreground">
            Report a bug so it can be fixed. We&apos;ll include your browser
            details automatically — please don&apos;t add any financial data.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button variant="outline" size="sm">
                <Bug className="size-3.5" />
                Report a bug
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Report a bug</DialogTitle>
              <DialogDescription>
                Fill this in and we&apos;ll open a pre-filled issue on GitHub for
                you to submit. Your browser details are attached automatically.
                Please don&apos;t include real financial data — the issue is
                public.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="bug-title">
                  Summary <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="bug-title"
                  value={title}
                  maxLength={TITLE_MAX}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="One line: what's broken?"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bug-what">
                  What happened? <span className="text-destructive">*</span>
                </Label>
                <textarea
                  id="bug-what"
                  value={what}
                  maxLength={TEXT_MAX}
                  onChange={(e) => setWhat(e.target.value)}
                  placeholder="Describe what went wrong."
                  className={feedbackTextareaClass}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bug-steps">Steps to reproduce</Label>
                <textarea
                  id="bug-steps"
                  value={steps}
                  maxLength={TEXT_MAX}
                  onChange={(e) => setSteps(e.target.value)}
                  placeholder="1. Go to… 2. Click… 3. See… (optional)"
                  className={feedbackTextareaClass}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bug-expected">
                  What did you expect to happen?
                </Label>
                <textarea
                  id="bug-expected"
                  value={expected}
                  maxLength={TEXT_MAX}
                  onChange={(e) => setExpected(e.target.value)}
                  placeholder="What should have happened instead? (optional)"
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
