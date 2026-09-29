import type { Content } from "@/content";
import { site } from "@/config/site";

/** Only production is indexed – Vercel previews would duplicate the site. */
export const indexable = () => !process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production";

/** Content fields still holding the template placeholders shouldn't reach Google. */
const PLACEHOLDERS = ["+420 777 000 000", "Doplňte ulici 123", "00000000", "https://www.instagram.com/", "https://www.facebook.com/"];
export const real = (v: string) => (v && !PLACEHOLDERS.includes(v.trim()) ? v.trim() : undefined);

/** schema.org description of the studio (Google local results, AI assistants). */
export function studioJsonLd(c: Content) {
  const street = real(c.raw("site.street"));
  return {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    "@id": `${site.url}/#studio`,
    name: site.name,
    // people still search for the studio's previous name
    alternateName: "MOVE IN ZONE",
    url: site.url,
    logo: `${site.url}/brand/logo-dark.png`,
    image: new URL(c.raw("homeHero.image") || "/brand/logo-dark.png", site.url).toString(),
    description: c.raw("site.description"),
    keywords: c.raw("site.keywords") || undefined,
    slogan: c.raw("site.tagline"),
    email: real(c.raw("site.email")),
    telephone: real(c.raw("site.phone")),
    address: {
      "@type": "PostalAddress",
      streetAddress: street,
      postalCode: real(c.raw("site.zip")),
      addressLocality: c.raw("site.city"),
      addressCountry: "CZ",
    },
    hasMap: real(c.raw("site.mapUrl")),
    sameAs: [c.raw("site.instagram"), c.raw("site.facebook")].map(real).filter(Boolean),
    parentOrganization: real(c.raw("site.companyName")) && { "@type": "Organization", name: c.raw("site.companyName") },
  };
}

/** Safe inline JSON for a <script type="application/ld+json">. */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
