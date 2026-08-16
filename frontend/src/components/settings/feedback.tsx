"use client";

import { BugReport } from "@/components/settings/bug-report";
import { FeatureRequest } from "@/components/settings/feature-request";
import { issueQueueUrl } from "@/lib/github";

export function Feedback() {
  return (
    <div className="max-w-xl space-y-4">
      <BugReport />
      <FeatureRequest />

      <p className="px-1 text-xs text-muted-foreground">
        Prefer to browse existing reports? See all{" "}
        <a
          href={issueQueueUrl("bug")}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          bug reports
        </a>{" "}
        or{" "}
        <a
          href={issueQueueUrl("feature-request")}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          feature requests
        </a>{" "}
        on GitHub.
      </p>
    </div>
  );
}
