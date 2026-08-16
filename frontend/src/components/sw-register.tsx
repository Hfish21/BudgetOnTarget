"use client";

import { useEffect } from "react";

/**
 * Registers the service worker and — crucially — keeps the running tab in sync
 * with the deployed version. Registering alone is not enough: without this, a
 * device that already has an old worker can keep serving stale HTML/JS long
 * after a deploy, so the app runs old code against a newly-saved file. That
 * produced real bugs (e.g. a negative "Money In" the current code can't even
 * output, and a dead month switcher) on phones pinned to an old build.
 *
 * The fix: check for an updated worker on load and whenever the tab refocuses,
 * and reload once when a new worker takes control — but only for returning
 * visitors (skip the very first install, which isn't an update).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const sw = navigator.serviceWorker;

    let refreshing = false;
    const hadController = !!sw.controller;
    const onControllerChange = () => {
      if (refreshing || !hadController) return;
      refreshing = true;
      window.location.reload();
    };
    sw.addEventListener("controllerchange", onControllerChange);

    let registration: ServiceWorkerRegistration | null = null;
    const checkForUpdate = () => registration?.update().catch(() => {});

    sw.register("/sw.js")
      .then((reg) => {
        registration = reg;
        reg.update().catch(() => {});
      })
      .catch(() => {});

    window.addEventListener("focus", checkForUpdate);

    return () => {
      sw.removeEventListener("controllerchange", onControllerChange);
      window.removeEventListener("focus", checkForUpdate);
    };
  }, []);

  return null;
}
