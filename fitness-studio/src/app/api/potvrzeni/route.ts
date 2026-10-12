import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getContent } from "@/content";
import { site } from "@/config/site";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { formatCode, issueConfirmation } from "@/domain/insurance";
import { getCurrentUser } from "@/lib/auth";
import { confirmationPdf } from "@/lib/insurance-pdf";

const ascii = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * PDF confirmation for the health insurance company (?rok=2026). Clients
 * download their own (with the birth date filled in), the admin anyone's
 * (&klient=<id>).
 */
export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me) redirect("/prihlaseni?next=/ucet");
  const params = new URL(req.url).searchParams;
  const year = Number(params.get("rok"));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return new Response("Neplatný rok.", { status: 400 });
  const db = await getDb();

  let user = me;
  const clientId = params.get("klient");
  if (clientId && clientId !== me.id) {
    if (me.role !== "admin") return new Response("Nepovoleno.", { status: 403 });
    if (!/^[0-9a-f-]{36}$/i.test(clientId)) return new Response("Klient nenalezen.", { status: 404 });
    const [u] = await db.select().from(users).where(eq(users.id, clientId));
    if (!u) return new Response("Klient nenalezen.", { status: 404 });
    user = u;
  } else if (!me.birthDate) {
    // the insurance company needs it – ask for it first
    redirect("/ucet/profil?pojistovna=1#osobni-udaje");
  }
  if (!user.birthDate)
    return new Response("Klient nemá vyplněné datum narození – bez něj potvrzení vystavit nejde. Doplní si ho v profilu na webu.", {
      status: 409,
    });

  const issued = await issueConfirmation(db, user, year);
  if (!issued) return new Response(`Za rok ${year} tu nejsou žádné zaplacené lekce ani členství.`, { status: 404 });
  const c = await getContent();
  const city = c.raw("site.city");
  const pdf = await confirmationPdf({
    provider: {
      company: c.raw("site.companyName"),
      ico: c.raw("site.ico"),
      address: `${c.raw("site.street")}, ${c.raw("site.zip")} ${city}`,
      city,
      email: c.raw("site.email"),
      phone: c.raw("site.phone"),
      web: site.url,
    },
    client: { name: user.name, birthDate: issued.birthDate },
    year,
    items: issued.items,
    total: issued.total,
    code: formatCode(issued.confirmation.code),
    issuedAt: issued.confirmation.createdAt,
    verifyUrl: `${site.url}/overeni?kod=${issued.confirmation.code}`,
  });
  const name = `Potvrzeni-pojistovna-${year}-${ascii(user.name) || "klient"}.pdf`;
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
