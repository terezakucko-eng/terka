"use client";

import { useEffect } from "react";
import { isStandalone } from "@/lib/install-prompt";

const KEY = "octopush-app-started";

/**
 * The studio's staff opening the app from the home screen land in the admin, not on
 * the page the icon happened to be saved from (Můj účet, Členská karta). Only the
 * first page of each launch – after that they can browse the web as usual.
 */
export function AdminAppStart() {
  useEffect(() => {
    if (!isStandalone()) return;
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, "1");
    } catch {
      return;
    }
    if (!location.pathname.startsWith("/admin")) location.replace("/admin");
  }, []);
  return null;
}
