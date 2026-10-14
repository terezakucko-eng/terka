import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getContent } from "@/content";
import { site } from "@/config/site";
import { getDb } from "@/db";
import { vouchers } from "@/db/schema";
import { formatVoucherCode, voucherStatus } from "@/domain/vouchers";
import { getCurrentUser } from "@/lib/auth";
import { voucherPdf } from "@/lib/voucher-pdf";
import { credits } from "@/lib/money";

/** The gift voucher as a printable PDF – for whoever bought it, and for the admin. */
export async function GET(_: Request, ctx: RouteContext<"/api/poukaz/[id]">) {
  const { id } = await ctx.params;
  const me = await getCurrentUser();
  if (!me) redirect("/prihlaseni?next=/ucet");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Poukaz nenalezen.", { status: 404 });
  const [v] = await (await getDb()).select().from(vouchers).where(eq(vouchers.id, id));
  if (!v || (v.buyerId !== me.id && me.role !== "admin")) return new Response("Poukaz nenalezen.", { status: 404 });
  if (voucherStatus(v) === "pending") return new Response("Poukaz ještě není zaplacený – stáhneš ho hned po zaplacení.", { status: 409 });
  const c = await getContent();
  const pdf = await voucherPdf({
    title: v.title,
    detail: v.kind === "amount" ? `Po uplatnění se připíše ${credits(v.credits ?? 0)} na lekce a služby studia.` : null,
    recipientName: v.recipientName,
    message: v.message,
    code: formatVoucherCode(v.code),
    validUntil: v.validUntil,
    redeemUrl: `${site.url}/poukaz?kod=${v.code}`,
    provider: {
      company: c.raw("site.companyName"),
      address: `${c.raw("site.street")}, ${c.raw("site.zip")} ${c.raw("site.city")}`,
      web: site.url,
      email: c.raw("site.email"),
      phone: c.raw("site.phone"),
    },
  });
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Darkovy-poukaz-OCTOPUSH-${v.code}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
