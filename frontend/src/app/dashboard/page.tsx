import { Suspense } from "react";
import { LegacyRedirect } from "@/components/legacy-redirect";

// The app moved from /dashboard to /app/dashboard when the landing page took
// over the site root. See LegacyRedirect for why this stub exists.
export default function LegacyDashboardRedirect() {
  return (
    <Suspense>
      <LegacyRedirect to="/app/dashboard" />
    </Suspense>
  );
}
