/** Red "new posts" badge in the menu: the newest post the visitor saw is remembered in their browser. */
export const BOARD_SEEN_KEY = "octopush-board-seen";
export const BOARD_SEEN_EVENT = "octopush-board-seen";
const FRESH_DAYS = 14;

/** How many posts the visitor hasn't seen. Someone who never opened the board only counts posts from the last two weeks. */
export function boardUnread(times: string[], seen: string | null, now = new Date()) {
  const s = seen ? Date.parse(seen) : NaN;
  const since = Number.isNaN(s) ? now.getTime() - FRESH_DAYS * 86_400_000 : s;
  return times.filter((t) => Date.parse(t) > since).length;
}

/** "3", or "9+" when there are more. */
export const badgeLabel = (n: number) => (n > 9 ? "9+" : String(n));
