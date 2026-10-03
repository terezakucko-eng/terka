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
  const label = c("popup.buttonLabel").trim();
  const external = /^https?:\/\//.test(url);
  // a finished poster says it all – without text and button only the (clickable) picture shows
  const imageOnly = !!image && !text && !(url && label);
  return (
    <PopupShell id={`${title}|${text}|${image}|${until}|${label}`} wide={imageOnly}>
      {image &&
        (url ? (
          // the picture is usually the poster itself – a tap on it does what the button does
          <Link
            href={url}
            data-popup-close
            {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
            className="relative block aspect-[16/9] overflow-hidden"
          >
            <ContentImage src={image} alt={title} fill sizes="(min-width: 640px) 48rem, 100vw" className="object-cover" />
          </Link>
        ) : (
          <div className="relative aspect-[16/9] overflow-hidden">
            <ContentImage src={image} alt="" fill sizes="(min-width: 640px) 32rem, 100vw" className="object-cover" />
          </div>
        ))}
      <div className={imageOnly ? "sr-only" : "p-7 sm:p-8"}>
        <h2 className="pr-8 text-2xl font-semibold tracking-tight">{title}</h2>
        {text && <p className="mt-3 whitespace-pre-line text-les/75">{nbsp(text)}</p>}
        {url && label && (
          <Link
            href={url}
            data-popup-close
            {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
            className="bg-gold mt-6 inline-flex rounded-full px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-les"
          >
            {label}
          </Link>
        )}
      </div>
    </PopupShell>
  );
}
