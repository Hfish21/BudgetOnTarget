"use client";

import { useEffect } from "react";
import { initLogger } from "@/lib/logger";

/** Installs the global error handlers once, on the client, inside the app. */
export function LoggerInit() {
  useEffect(() => {
    initLogger();
  }, []);
  return null;
}
