import { Suspense } from "react";
import { LegacyRedirect } from "@/components/legacy-redirect";

// The app moved from /settings to /app/settings when the landing page took
// over the site root. See LegacyRedirect for why this stub exists.
export default function LegacySettingsRedirect() {
  return (
    <Suspense>
      <LegacyRedirect to="/app/settings" />
    </Suspense>
  );
}
