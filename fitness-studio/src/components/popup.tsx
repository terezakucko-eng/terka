import Link from "next/link";
import { getContent } from "@/content";
import { dateKey } from "@/lib/dates";
import { nbsp } from "@/lib/typography";
import { ContentImage } from "./content-image";
import { PopupShell } from "./popup-shell";

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
  const linkProps = (href: string) => ({
    href,
    "data-popup-close": true,
    ...(/^https?:\/\//.test(href) ? { target: "_blank", rel: "noreferrer" } : {}),
  });
  // a finished poster says it all – without text only the (clickable) picture and the buttons show
  const imageOnly = !!image && !text;
  const buttonRow = buttons.length > 0 && (
    <div className={imageOnly ? "flex flex-col gap-2 p-4 sm:flex-row sm:p-5" : "mt-6 flex flex-col gap-2 sm:flex-row"}>
      {buttons.map((b) => (
        <Link
          key={b.url + b.label}
          {...linkProps(b.url)}
          className="bg-gold inline-flex flex-1 items-center justify-center rounded-full px-6 py-3 text-center text-xs font-semibold uppercase tracking-[0.15em] text-les"
        >
          {b.label}
        </Link>
      ))}
    </div>
  );
  return (
    <PopupShell id={`${title}|${text}|${image}|${until}|${buttons.map((b) => b.label).join("|")}`} wide={imageOnly}>
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
