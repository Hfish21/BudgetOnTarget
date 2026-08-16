"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Bridges the pre-landing-page URLs, where the app lived at the site root
 * (`/dashboard`) rather than under `/app`. Bookmarks and already-installed
 * PWAs still point at the old paths, and GitHub Pages serves static files with
 * no server-side redirect available — so the redirect has to happen client
 * side.
 *
 * Query strings carry over: a bookmarked `/dashboard?year=2026&month=6` should
 * land on the same month it always did.
 *
 * Safe to delete once the old URLs have gone quiet.
 */
export function LegacyRedirect({ to }: { to: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(qs ? `${to}?${qs}` : to);
  }, [router, searchParams, to]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
    </div>
  );
}
