/**
 * Helpers for handing a user off to GitHub's pre-filled "new issue" page.
 *
 * This app is a static, offline PWA with no backend and no secrets, so it
 * can't write to GitHub itself. Instead it constructs a URL that opens
 * GitHub's own issue form with fields pre-filled; the user submits it under
 * their own GitHub account. Note: GitHub only pre-fills title/input/textarea
 * fields via query params — dropdown/checkbox fields cannot be pre-filled, so
 * fold any such value into a textarea body instead.
 */
export const GITHUB_REPO = "Hfish21/BudgetOnTarget";

export const TITLE_MAX = 120;
export const TEXT_MAX = 2000;

/** Build a pre-filled GitHub new-issue URL for the given template + fields. */
export function newIssueUrl(
  template: string,
  fields: Record<string, string>
): string {
  const params = new URLSearchParams({ template, ...fields });
  return `https://github.com/${GITHUB_REPO}/issues/new?${params.toString()}`;
}

/** Open GitHub's pre-filled issue form in a new tab; the user submits there. */
export function openNewIssue(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Link to the filtered issue queue for a given label. */
export function issueQueueUrl(label: string): string {
  return `https://github.com/${GITHUB_REPO}/issues?q=${encodeURIComponent(
    `is:issue label:${label}`
  )}`;
}
