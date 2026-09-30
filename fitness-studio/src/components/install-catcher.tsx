"use client";

import { useEffect } from "react";
import { catchInstallPrompt } from "@/lib/install-prompt";

/**
 * Mounted on every page: registers the service worker (browsers only offer
 * "install" for sites that have one) and keeps the install offer for later.
 */
export function InstallCatcher() {
  useEffect(() => {
    catchInstallPrompt();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
