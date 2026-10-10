"use client";

import { useEffect, useSyncExternalStore } from "react";
import { BOARD_SEEN_EVENT, BOARD_SEEN_KEY, badgeLabel, boardUnread } from "@/lib/board-seen";
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

/** Red badge with the number of board posts the visitor hasn't opened yet – like an app icon on a phone. */
export function BoardBadge({ times, className }: { times: string[]; className?: string }) {
  const seen = useSyncExternalStore(subscribe, seenNow, () => SERVER);
  const n = seen === SERVER ? 0 : boardUnread(times, seen);
  if (!n) return null;
  const label = n === 1 ? "1 nový příspěvek" : n < 5 ? `${n} nové příspěvky` : `${n} nových příspěvků`;
  return (
    <span
      title={`${label} na nástěnce`}
      className={cx(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#e5372f] px-1 text-[11px] font-bold leading-none tracking-normal text-white shadow-[0_0_0_2px_#1b1f15]",
        className,
      )}
    >
      {badgeLabel(n)}
      <span className="sr-only"> – {label} na nástěnce</span>
    </span>
  );
}

/** On the board page: remember the newest post as seen, so the badge goes away. */
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
