/** Cookie remembering the closed promo bar – read on the server, so a closed bar never flashes. */
export const PROMO_COOKIE = "octopush-promo-closed";

/** Short, cookie-safe fingerprint of the bar's text + end date (a new text shows again). */
export function promoId(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
