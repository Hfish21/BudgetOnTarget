"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// /app is the app's entry point — the manifest start_url and the landing
// page's CTA both target it. The dashboard is the real landing spot.
export default function AppIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/app/dashboard");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
    </div>
  );
}
