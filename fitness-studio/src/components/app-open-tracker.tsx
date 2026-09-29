"use client";

import { useEffect } from "react";
import { appOpenedAction } from "@/app/actions/card";

/** Notes (once) that the client opened the site from the home screen – for Admin → Klienti. */
export function AppOpenTracker() {
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    if (standalone) void appOpenedAction().catch(() => {});
  }, []);
  return null;
}
