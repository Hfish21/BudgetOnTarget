import { Suspense } from "react";
import { LegacyRedirect } from "@/components/legacy-redirect";

// The app moved from /import to /app/import when the landing page took
// over the site root. See LegacyRedirect for why this stub exists.
export default function LegacyImportRedirect() {
  return (
    <Suspense>
      <LegacyRedirect to="/app/import" />
    </Suspense>
  );
}
