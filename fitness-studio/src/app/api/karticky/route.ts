import { eq } from "drizzle-orm";
import { getContent } from "@/content";
import { site } from "@/config/site";
import { getDb } from "@/db";
import { passCards } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { passCardsPdf, passCardsSheetPdf } from "@/lib/pass-card-pdf";

/**
 * Pošli to dál cards to print – all of them, or one (?id=): card size for the print shop, or
 * A4 sheets for duplex printing at the studio (?arch=a4). Admin only.
 */
export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (me?.role !== "admin") return new Response("Nenalezeno.", { status: 404 });
  const id = new URL(req.url).searchParams.get("id");
  const db = await getDb();
  const cards = id
    ? /^[0-9a-f-]{36}$/i.test(id)
      ? await db.select().from(passCards).where(eq(passCards.id, id))
      : []
    : await db.select().from(passCards).where(eq(passCards.isActive, true)).orderBy(passCards.createdAt, passCards.label);
  if (!cards.length) return new Response("Kartička nenalezena.", { status: 404 });
  const c = await getContent();
  const sheet = new URL(req.url).searchParams.get("arch") === "a4";
  const pdf = await (sheet ? passCardsSheetPdf : passCardsPdf)(
    cards.map((k) => ({ label: k.label, code: k.code, url: `${site.url}/karticka/${k.code}` })),
    `OCTOPUSH · ${c.raw("site.street")}, ${c.raw("site.city")}`,
  );
  const name = (cards.length === 1 ? `Posli-to-dal-${cards[0].code}` : "Posli-to-dal-karticky") + (sheet ? "-A4" : "");
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
