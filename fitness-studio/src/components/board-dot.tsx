"use client";

import { useEffect, useSyncExternalStore } from "react";
import { BOARD_SEEN_EVENT, BOARD_SEEN_KEY, boardHasNew } from "@/lib/board-seen";
import { cx } from "./ui";

const SERVER = "\u0000server";
const subscribe = (cb: () => void) => {
  window.addEventListener(BOARD_SEEN_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(BOARD_SEEN_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};
const seenNow = () => {
  try {
    return localStorage.getItem(BOARD_SEEN_KEY);
  } catch {
    return null;
  }
};

/** Gold dot next to "Nástěnka" while there's a post the visitor hasn't opened yet. */
export function BoardNewDot({ latest, className }: { latest: string | null; className?: string }) {
  const seen = useSyncExternalStore(subscribe, seenNow, () => SERVER);
  if (seen === SERVER || !boardHasNew(latest, seen)) return null;
  return (
    <span
      title="Nové na nástěnce"
      className={cx("inline-block size-2 rounded-full bg-zlato-light shadow-[0_0_0_3px_rgba(230,193,143,0.25)]", className)}
    >
      <span className="sr-only">Nové na nástěnce</span>
    </span>
  );
}

/** On the board page: remember the newest post as seen, so the dot goes away. */
export function MarkBoardSeen({ latest }: { latest: string | null }) {
  useEffect(() => {
    if (!latest) return;
    try {
      localStorage.setItem(BOARD_SEEN_KEY, latest);
    } catch {}
    window.dispatchEvent(new Event(BOARD_SEEN_EVENT));
  }, [latest]);
  return null;
}
