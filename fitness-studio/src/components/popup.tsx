import Link from "next/link";
import { getContent } from "@/content";
import { getDb } from "@/db";
import { seatsLeft } from "@/domain/booking";
import { dateKey } from "@/lib/dates";
import { pluralCs } from "@/lib/money";
import { weekdayIndex } from "@/lib/popup-seen";
import { nbsp } from "@/lib/typography";
import { ContentImage } from "./content-image";
import { PopupShell } from "./popup-shell";

const SESSION_URL = /^(?:https?:\/\/[^/]+)?\/rozvrh\/([0-9a-f-]{36})\/?(?:[?#].*)?$/i;

function spotsHint(n: number) {
  if (n === 0) return "Obsazeno – zapiš se mezi náhradníky";
  if (n === 1) return "Poslední volné místo!";
  if (n <= 5) return `Poslední ${pluralCs(n, "volné místo", "volná místa", "volných míst")}!`;
  return `Volno: ${pluralCs(n, "místo", "místa", "míst")}`;
}

/** One-off announcement window, edited in Obsah webu → Vyskakovací okno. */
export async function Popup() {
  const c = await getContent();
  const title = c("popup.title").trim();
  const until = c("popup.until").trim();
  if (!title || (/^\d{4}-\d{2}-\d{2}$/.test(until) && dateKey(new Date()) > until)) return null;
  const text = c("popup.text").trim();
  const image = c("popup.image").trim();
  const url = c("popup.buttonUrl").trim();
  const buttons = [
    { label: c("popup.buttonLabel").trim(), url },
    { label: c("popup.buttonLabel2").trim(), url: c("popup.buttonUrl2").trim() },
  ].filter((b) => b.label && b.url);
  // a button leading to a class can show how many spots are left – live, so "last spots" is always true
  const showSpots = /^(ano|a|yes|1)$/i.test(c("popup.showSpots").trim());
  const sessionOf = (href: string) => href.match(SESSION_URL)?.[1];
  const ids = showSpots ? buttons.map((b) => sessionOf(b.url)).filter((id): id is string => !!id) : [];
  const none = new Map<string, number>();
  // the pop-up is on every page – a hiccup here must not take the site down
  const left = ids.length > 0 ? await seatsLeft(await getDb(), ids).catch(() => none) : none;
  const linkProps = (href: string) => ({
    href,
    "data-popup-close": true,
    ...(/^https?:\/\//.test(href) ? { target: "_blank", rel: "noreferrer" } : {}),
  });
  // a finished poster says it all – without text only the (clickable) picture and the buttons show
  const imageOnly = !!image && !text;
  const buttonRow = buttons.length > 0 && (
    <div className={imageOnly ? "flex flex-col gap-2 p-4 sm:flex-row sm:p-5" : "mt-6 flex flex-col gap-2 sm:flex-row"}>
      {buttons.map((b) => {
        const n = left.get(sessionOf(b.url) ?? "");
        return (
          <div key={b.url + b.label} className="flex flex-1 flex-col items-stretch gap-1.5">
            <Link
              {...linkProps(b.url)}
              className="bg-gold inline-flex items-center justify-center rounded-full px-6 py-3 text-center text-xs font-semibold uppercase tracking-[0.15em] text-les"
            >
              {b.label}
            </Link>
            {n !== undefined && (
              <span className={`text-center text-xs font-semibold ${n <= 5 ? "text-chyba" : "text-les/60"}`}>{spotsHint(n)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
  return (
    <PopupShell
      id={`${title}|${text}|${image}|${until}|${buttons.map((b) => b.label).join("|")}`}
      wide={imageOnly}
      repeatDay={weekdayIndex(c("popup.repeatDay"))}
    >
      {image &&
        (url && buttons.length < 2 ? (
          // the picture is usually the poster itself – a tap on it does what the button does
          <Link {...linkProps(url)} className="relative block aspect-[16/9] overflow-hidden">
            <ContentImage src={image} alt={title} fill sizes="(min-width: 640px) 48rem, 100vw" className="object-cover" />
          </Link>
        ) : (
          <div className="relative aspect-[16/9] overflow-hidden">
            <ContentImage src={image} alt={title} fill sizes="(min-width: 640px) 48rem, 100vw" className="object-cover" />
          </div>
        ))}
      {imageOnly ? (
        <>
          <h2 className="sr-only">{title}</h2>
          {buttonRow}
        </>
      ) : (
        <div className="p-7 sm:p-8">
          <h2 className="pr-8 text-2xl font-semibold tracking-tight">{title}</h2>
          {text && <p className="mt-3 whitespace-pre-line text-les/75">{nbsp(text)}</p>}
          {buttonRow}
        </div>
      )}
    </PopupShell>
  );
}
