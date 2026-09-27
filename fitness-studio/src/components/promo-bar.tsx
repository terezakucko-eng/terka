import Link from "next/link";
import { getContent } from "@/content";
import { dateKey } from "@/lib/dates";
import { PromoBarShell } from "./promo-bar-shell";

/** Thin announcement bar above the menu, edited in Obsah webu → Akční lišta. */
export async function PromoBar() {
  const c = await getContent();
  const text = c("promoBar.text").trim();
  const until = c("promoBar.until").trim();
  if (!text || (/^\d{4}-\d{2}-\d{2}$/.test(until) && dateKey(new Date()) > until)) return null;
  const url = c("promoBar.linkUrl").trim();
  const label = c("promoBar.linkLabel").trim();
  const external = /^https?:\/\//.test(url);
  return (
    <PromoBarShell id={`${text}|${until}`}>
      <span>{text}</span>
      {url && label && (
        <Link
          href={url}
          {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
          className="ml-3 whitespace-nowrap font-semibold underline underline-offset-4 hover:no-underline"
        >
          {label} →
        </Link>
      )}
    </PromoBarShell>
  );
}
