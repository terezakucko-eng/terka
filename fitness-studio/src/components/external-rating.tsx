import { Star, ThumbsUp } from "lucide-react";

/** "4,9 z 5 na Googlu (25 recenzí)" / "98 % doporučení na Facebooku (29 recenzí)" – links to the reviews there. */
export function ExternalRating({ kind, text, href }: { kind: "google" | "facebook"; text: string; href?: string }) {
  const Icon = kind === "google" ? Star : ThumbsUp;
  const body = (
    <>
      <Icon className="size-4 fill-current text-zlato" aria-hidden /> {text}
    </>
  );
  return href ? (
    <a href={href} target="_blank" rel="noopener" className="inline-flex items-center gap-2 underline-offset-4 hover:underline">
      {body} ↗
    </a>
  ) : (
    <p className="inline-flex items-center gap-2">{body}</p>
  );
}
