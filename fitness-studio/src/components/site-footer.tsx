import Link from "next/link";
import { getContent } from "@/content";
import { Symbol, Wordmark } from "./brand";

export async function SiteFooter() {
  const c = await getContent();
  const links = [
    ["Instagram", c("site.instagram")],
    ["Facebook", c("site.facebook")],
    ["WhatsApp", c("site.whatsapp")],
  ].filter(([, href]) => href);
  return (
    <footer id="kontakt" className="bg-les text-papir/80">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-4">
              <Symbol className="w-14" />
              <Wordmark className="w-44" />
            </div>
            <p className="eyebrow mt-6 text-zlato-light/80">{c("site.tagline")}</p>
            <p className="eyebrow empty:hidden mt-3 text-papir/50">{c("site.pillars")}</p>
          </div>
          <div className="space-y-2 text-sm">
            <p className="eyebrow mb-4 text-zlato">{c("nav.footerStudio")}</p>
            <p>{c("site.street")}</p>
            <p>{c("site.zip")} {c("site.city")}</p>
            <p><a className="hover:text-zlato-light" href={`mailto:${c("site.email")}`}>{c("site.email")}</a></p>
            <p><a className="hover:text-zlato-light" href={`tel:${c("site.phone").replace(/\s/g, "")}`}>{c("site.phone")}</a></p>
            <p>
              <a className="underline decoration-zlato/40 underline-offset-4 hover:text-zlato-light" href={c("site.mapUrl")} target="_blank" rel="noreferrer">
                Mapa
              </a>
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <p className="eyebrow mb-4 text-zlato">{c("nav.footerLinks")}</p>
            <p><Link className="hover:text-zlato-light" href="/rozvrh">{c("nav.schedule")}</Link></p>
            <p><Link className="hover:text-zlato-light" href="/cenik">{c("nav.pricing")}</Link></p>
            <p><Link className="hover:text-zlato-light" href="/obchodni-podminky">Obchodní podmínky</Link></p>
            <p><Link className="hover:text-zlato-light" href="/ochrana-osobnich-udaju">Ochrana osobních údajů</Link></p>
            <p className="flex gap-4 pt-2">
              {links.map(([label, href]) => (
                <a key={label} className="hover:text-zlato-light" href={href} target="_blank" rel="noreferrer">{label}</a>
              ))}
            </p>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-zlato/15 pt-6 text-xs text-papir/40 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} {c("site.companyName")} · IČO {c("site.ico")}</p>
          <p className="font-script text-2xl text-zlato/70">{c("site.claim")}</p>
        </div>
      </div>
    </footer>
  );
}
