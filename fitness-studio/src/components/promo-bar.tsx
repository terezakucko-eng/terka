import Link from "next/link";
import { cookies } from "next/headers";
import { PROMO_COOKIE, promoId } from "@/lib/promo";
import { getContent } from "@/content";
import { dateKey } from "@/lib/dates";
import { PromoBarShell } from "./promo-bar-shell";
import { getDb } from "@/db";
import { seatsLeft } from "@/domain/booking";
import { isYes, sessionOf, spotsHint } from "@/lib/spots";

/** Thin announcement bar above the menu, edited in Obsah webu → Akční lišta. */
export async function PromoBar() {
  const c = await getContent();
  const text = c("promoBar.text").trim();
  const until = c("promoBar.until").trim();
  if (!text || (/^\d{4}-\d{2}-\d{2}$/.test(until) && dateKey(new Date()) > until)) return null;
  const id = promoId(`${text}|${until}`);
  if ((await cookies()).get(PROMO_COOKIE)?.value === id) return null;
  const url = c("promoBar.linkUrl").trim();
  const label = c("promoBar.linkLabel").trim();
  const external = /^https?:\/\//.test(url);
  // a link to one class can say how many places are left – counted on every view, so it stays true
  const session = isYes(c("promoBar.showSpots")) ? sessionOf(url) : undefined;
  const left = session ? (await seatsLeft(await getDb(), [session]).catch(() => new Map<string, number>())).get(session) : undefined;
  return (
    <PromoBarShell id={id}>
      <span className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
        <span className="font-semibold">{text}</span>
        {left !== undefined && (
          <span className={left <= 4 ? "rounded-full bg-chyba px-2.5 py-0.5 text-xs font-bold text-white" : "text-xs font-semibold"}>
            {left <= 4 && left > 0 ? "🔥 " : ""}{spotsHint(left)}
          </span>
        )}
        {url && label && (
          <Link
            href={url}
            {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
            className="inline-flex animate-[cta_2.4s_ease-in-out_infinite] items-center gap-1.5 whitespace-nowrap rounded-full bg-les px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-papir shadow-md hover:bg-les/90"
          >
            {left === 0 ? "Zapsat se do pořadníku" : label} →
          </Link>
        )}
      </span>
    </PromoBarShell>
  );
}
