import { Suspense } from "react";
import { LegacyRedirect } from "@/components/legacy-redirect";

// The app moved from /targets to /app/targets when the landing page took
// over the site root. See LegacyRedirect for why this stub exists.
export default function LegacyTargetsRedirect() {
  return (
    <Suspense>
      <LegacyRedirect to="/app/targets" />
    </Suspense>
  );
}
