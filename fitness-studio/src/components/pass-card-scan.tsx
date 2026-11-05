"use client";

import { useEffect } from "react";
import { passCardScanAction } from "@/app/actions/pass-card";

/**
 * One scan per visit of a card's page: a reload or „Nezajímá mě“ in the same tab doesn't count again,
 * and link previews (which don't run scripts) don't count at all.
 */
export function PassCardScan({ code }: { code: string }) {
  useEffect(() => {
    const key = `karticka-${code.toUpperCase()}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // storage blocked – count it anyway
    }
    passCardScanAction(code).catch(() => {});
  }, [code]);
  return null;
}
