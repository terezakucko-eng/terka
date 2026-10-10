/** "New on the board" dot in the menu: the newest post the visitor saw is remembered in their browser. */
export const BOARD_SEEN_KEY = "octopush-board-seen";
export const BOARD_SEEN_EVENT = "octopush-board-seen";
const FRESH_DAYS = 14;

/** Is there a post the visitor hasn't seen? Someone who never opened the board only gets the dot for a recent post. */
export function boardHasNew(latest: string | null, seen: string | null, now = new Date()) {
  const l = latest ? Date.parse(latest) : NaN;
  if (Number.isNaN(l)) return false;
  const s = seen ? Date.parse(seen) : NaN;
  if (!Number.isNaN(s)) return l > s;
  return now.getTime() - l < FRESH_DAYS * 86_400_000;
}
