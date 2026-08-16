import { Suspense } from "react";
import { LegacyRedirect } from "@/components/legacy-redirect";

// The app moved from /trends to /app/trends when the landing page took
// over the site root. See LegacyRedirect for why this stub exists.
export default function LegacyTrendsRedirect() {
  return (
    <Suspense>
      <LegacyRedirect to="/app/trends" />
    </Suspense>
  );
}
