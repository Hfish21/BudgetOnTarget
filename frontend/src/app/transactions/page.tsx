import { Suspense } from "react";
import { LegacyRedirect } from "@/components/legacy-redirect";

// The app moved from /transactions to /app/transactions when the landing page took
// over the site root. See LegacyRedirect for why this stub exists.
export default function LegacyTransactionsRedirect() {
  return (
    <Suspense>
      <LegacyRedirect to="/app/transactions" />
    </Suspense>
  );
}
