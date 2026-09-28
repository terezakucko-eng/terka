/**
 * Turns a YouTube or Vimeo link into an embeddable player URL, or null.
 * YouTube goes through youtube-nocookie.com so no tracking cookies are set before playing.
 */
export function videoEmbedUrl(link: string | null | undefined): string | null {
  if (!link) return null;
  let u: URL;
  try {
    u = new URL(link.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let yt: string | null = null;
  if (host === "youtu.be") yt = u.pathname.slice(1);
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    yt = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1] ?? null;
  }
  if (yt && /^[\w-]{6,20}$/.test(yt)) return `https://www.youtube-nocookie.com/embed/${yt}?rel=0`;
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = u.pathname.match(/(\d{5,})/)?.[1];
    if (id) return `https://player.vimeo.com/video/${id}?dnt=1`;
  }
  return null;
}
