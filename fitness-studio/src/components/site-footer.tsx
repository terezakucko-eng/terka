import Link from "next/link";
import { site } from "@/config/site";
import { Symbol, Wordmark } from "./brand";

export function SiteFooter() {
  return (
    <footer id="kontakt" className="bg-les text-papir/80">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-4">
              <Symbol className="w-14" />
              <Wordmark className="w-44" />
            </div>
            <p className="eyebrow mt-6 text-zlato-light/80">{site.tagline}</p>
            <p className="eyebrow mt-3 text-papir/50">{site.pillars.join(" · ")}</p>
          </div>
          <div className="space-y-2 text-sm">
            <p className="eyebrow mb-4 text-zlato">Studio</p>
            <p>{site.address.street}</p>
            <p>
              {site.address.zip} {site.address.city}
            </p>
            <p>
              <a className="hover:text-zlato-light" href={`mailto:${site.email}`}>
                {site.email}
              </a>
            </p>
            <p>
              <a className="hover:text-zlato-light" href={`tel:${site.phone.replace(/\s/g, "")}`}>
                {site.phone}
              </a>
            </p>
            <p>
              <a className="underline decoration-zlato/40 underline-offset-4 hover:text-zlato-light" href={site.address.mapUrl} target="_blank" rel="noreferrer">
                Mapa
              </a>
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <p className="eyebrow mb-4 text-zlato">Odkazy</p>
            <p><Link className="hover:text-zlato-light" href="/rozvrh">Rozvrh a rezervace</Link></p>
            <p><Link className="hover:text-zlato-light" href="/cenik">Ceník a permanentky</Link></p>
            <p><Link className="hover:text-zlato-light" href="/obchodni-podminky">Obchodní podmínky</Link></p>
            <p><Link className="hover:text-zlato-light" href="/ochrana-osobnich-udaju">Ochrana osobních údajů</Link></p>
            <p className="flex gap-4 pt-2">
              <a className="hover:text-zlato-light" href={site.social.instagram} target="_blank" rel="noreferrer">Instagram</a>
              <a className="hover:text-zlato-light" href={site.social.facebook} target="_blank" rel="noreferrer">Facebook</a>
              {site.social.whatsapp && (
                <a className="hover:text-zlato-light" href={site.social.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
              )}
            </p>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-zlato/15 pt-6 text-xs text-papir/40 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} {site.company.name} · IČO {site.company.ico}</p>
          <p className="font-script text-2xl text-zlato/70">{site.claim}</p>
        </div>
      </div>
    </footer>
  );
}
