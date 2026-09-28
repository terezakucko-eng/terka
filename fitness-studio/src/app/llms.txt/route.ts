import { connection } from "next/server";
import { site } from "@/config/site";
import { getContent } from "@/content";
import { getDb } from "@/db";
import { activeMassageServices } from "@/domain/massages";
import { formatPrice } from "@/lib/money";
import { activeClassTypes, activeProducts } from "@/lib/queries";
import { real } from "@/lib/seo";

const plain = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** https://llmstxt.org – a plain summary of the studio for AI assistants. */
export async function GET() {
  await connection();
  const db = await getDb();
  const [c, types, products, massages] = await Promise.all([
    getContent(),
    activeClassTypes(db),
    activeProducts(db),
    activeMassageServices(db).catch(() => []),
  ]);
  const u = (p: string) => `${site.url}${p}`;
  const address = [real(c.raw("site.street")), [real(c.raw("site.zip")), c.raw("site.city")].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const lines = [
    `# ${site.name}`,
    "",
    `> ${plain(c.raw("site.description"))}`,
    "",
    `Studio pohybu, ${c.raw("site.city") || "Ostrava"}. Lekce se rezervují a platí online na ${site.url}.`,
    "",
    "## Kontakt",
    address && `- Adresa: ${address}`,
    real(c.raw("site.email")) && `- E-mail: ${c.raw("site.email")}`,
    real(c.raw("site.phone")) && `- Telefon: ${c.raw("site.phone")}`,
    real(c.raw("site.instagram")) && `- Instagram: ${c.raw("site.instagram")}`,
    real(c.raw("site.facebook")) && `- Facebook: ${c.raw("site.facebook")}`,
    "",
    "## Stránky",
    `- [Rozvrh a rezervace](${u("/rozvrh")}): aktuální lekce a volná místa`,
    `- [Lekce](${u("/lekce")}): popis jednotlivých typů lekcí`,
    `- [Ceník](${u("/cenik")}): členství, permanentky, kredity a jednorázové vstupy`,
    `- [Masáže](${u("/masaze")}): nabídka masáží a online rezervace`,
    `- [O mně](${u("/o-mne")}): kdo stojí za studiem`,
    `- [Nástěnka](${u("/nastenka")}): novinky ze studia`,
    `- [Obchodní podmínky](${u("/obchodni-podminky")})`,
    "",
    types.length ? "## Lekce" : "",
    ...types.map((t) => `- ${t.name} (${t.durationMin} min, ${t.level})${t.description ? `: ${plain(t.description)}` : ""}`),
    "",
    products.length ? "## Ceník" : "",
    ...products.map((p) => `- ${p.name}: ${formatPrice(p.price)}${p.description ? ` – ${plain(p.description)}` : ""}`),
    "",
    massages.length ? "## Masáže" : "",
    ...massages.map((m) => `- [${m.name}](${u(`/masaze/${m.slug}`)}) (${m.durationMin} min): ${formatPrice(m.price)}`),
  ];
  const body = lines.filter((l) => l !== undefined).join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
