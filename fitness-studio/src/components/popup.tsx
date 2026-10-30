import Link from "next/link";
import { getContent } from "@/content";
import { getDb } from "@/db";
import { seatsLeft } from "@/domain/booking";
import { dateKey } from "@/lib/dates";
import { popupOver, popupSlot, weekdayIndex } from "@/lib/popup-seen";
import { nbsp } from "@/lib/typography";
import { isYes, sessionOf, spotsHint } from "@/lib/spots";
import { ContentImage } from "./content-image";
import { PopupShell } from "./popup-shell";


/**
 * One-off announcement window, edited in Obsah webu → Vyskakovací okno. The next one
 * (Další vyskakovací okno) takes its place from its date on, so it can be prepared ahead.
 */
export async function Popup() {
  const c = await getContent();
  const today = dateKey(new Date());
  const s = popupSlot({ title: c("popupNext.title"), from: c("popupNext.from") }, today);
  const title = c(`${s}.title`).trim();
  const until = c(`${s}.until`).trim();
  if (!title || popupOver(until, today)) return null;
  const text = c(`${s}.text`).trim();
  const image = c(`${s}.image`).trim();
  // a poster's text is too small on a phone – a portrait version shows there instead
  const imageMobile = image ? c(`${s}.imageMobile`).trim() : "";
  const url = c(`${s}.buttonUrl`).trim();
  const buttons = [
    { label: c(`${s}.buttonLabel`).trim(), url },
    { label: c(`${s}.buttonLabel2`).trim(), url: c(`${s}.buttonUrl2`).trim() },
  ].filter((b) => b.label && b.url);
  // a button leading to a class can show how many spots are left – live, so "last spots" is always true
  const showSpots = isYes(c(`${s}.showSpots`));
  const ids = showSpots ? buttons.map((b) => sessionOf(b.url)).filter((id): id is string => !!id) : [];
  const none = new Map<string, number>();
  // the pop-up is on every page – a hiccup here must not take the site down
  const left = ids.length > 0 ? await seatsLeft(await getDb(), ids).catch(() => none) : none;
  const linkProps = (href: string) => ({
    href,
    "data-popup-close": true,
    ...(/^https?:\/\//.test(href) ? { target: "_blank", rel: "noreferrer" } : {}),
  });
  const first = left.get(sessionOf(buttons[0]?.url ?? "") ?? "");
  // a finished poster says it all – without text only the (clickable) picture and the buttons show
  const imageOnly = !!image && !text;
  const buttonRow = buttons.length > 0 && (
    <div className={imageOnly ? "flex flex-col gap-2 p-4 sm:flex-row sm:p-5" : "mt-6 flex flex-col gap-2 sm:flex-row"}>
      {buttons.map((b, i) => {
        const n = left.get(sessionOf(b.url) ?? "");
        return (
          <div key={b.url + b.label} className="flex flex-1 flex-col items-stretch gap-1.5">
            <Link
              {...linkProps(b.url)}
              className={
                i === 0
                  ? "bg-gold inline-flex animate-[cta_2.4s_ease-in-out_infinite] items-center justify-center gap-2 rounded-full px-7 py-4 text-center text-sm font-bold uppercase tracking-[0.14em] text-les shadow-[0_10px_28px_-10px_rgba(103,67,41,.7)]"
                  : "bg-gold inline-flex items-center justify-center rounded-full px-6 py-3 text-center text-xs font-semibold uppercase tracking-[0.15em] text-les"
              }
            >
              {b.label}
              {i === 0 && <span aria-hidden>→</span>}
            </Link>
            {n !== undefined && (
              <span
                className={
                  n <= 4
                    ? "self-center rounded-full bg-chyba/10 px-3 py-1 text-center text-sm font-bold text-chyba"
                    : "text-center text-xs font-semibold text-les/60"
                }
              >
                {n > 0 && n <= 4 ? "🔥 " : ""}
                {spotsHint(n)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
  const picture = (
    <>
      {imageMobile && (
        <div className="relative aspect-[4/5] overflow-hidden sm:hidden">
          <ContentImage src={imageMobile} alt={title} fill sizes="100vw" className="object-cover" />
        </div>
      )}
      <div className={imageMobile ? "relative hidden aspect-[16/9] overflow-hidden sm:block" : "relative aspect-[16/9] overflow-hidden"}>
        <ContentImage src={image} alt={title} fill sizes="(min-width: 640px) 48rem, 100vw" className="object-cover" />
      </div>
    </>
  );
  return (
    <PopupShell
      id={`${title}|${text}|${image}|${until}|${buttons.map((b) => b.label).join("|")}`}
      wide={imageOnly}
      repeatDay={weekdayIndex(c(`${s}.repeatDay`))}
    >
      {image &&
        (url && buttons.length < 2 ? (
          // the picture is usually the poster itself – a tap on it does what the button does
          <Link {...linkProps(url)} className="block">
            {picture}
          </Link>
        ) : (
          picture
        ))}
      {imageOnly ? (
        <>
          <h2 className="sr-only">{title}</h2>
          {buttonRow}
        </>
      ) : (
        <div className="p-7 sm:p-8">
          {/* the live count up top, so it's the first thing read */}
          {first !== undefined && first <= 4 && (
            <p className="mb-3 inline-flex rounded-full bg-chyba/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-chyba">🔥 {spotsHint(first)}</p>
          )}
          <h2 className="pr-8 text-2xl font-semibold tracking-tight">{title}</h2>
          {text && <p className="mt-3 whitespace-pre-line text-les/75">{nbsp(text)}</p>}
          {buttonRow}
        </div>
      )}
    </PopupShell>
  );
}
