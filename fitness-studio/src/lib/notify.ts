import { eq, inArray } from "drizzle-orm";
import type { DB } from "@/db";
import { classSessions, classTypes, users, type Booking, type Order } from "@/db/schema";
import { site } from "@/config/site";
import type { StrikeOutcome } from "@/domain/strikes";
import { periodLabel } from "@/domain/membership-fees";
import { getContent } from "@/content";
import { formatPrice } from "./money";
import { formatDate, formatDay, formatTime } from "./dates";
import { sendEmail } from "./email-templates";
import { greetName } from "@/lib/vocative";
import { pushQuietly } from "./push";

async function describe(db: DB, sessionId: string) {
  const [row] = await db
    .select({ s: classSessions, ct: classTypes })
    .from(classSessions)
    .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
    .where(eq(classSessions.id, sessionId));
  return `${row.ct.name} – ${formatDay(row.s.startsAt)} v ${formatTime(row.s.startsAt)}`;
}

async function emails(db: DB, ids: string[]) {
  if (!ids.length) return new Map<string, { email: string; name: string; bookingEmails: boolean }>();
  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name, bookingEmails: users.bookingEmails })
    .from(users)
    .where(inArray(users.id, ids));
  return new Map(rows.map((r) => [r.id, r]));
}

const link = (sessionId: string) => `${site.url}/rozvrh/${sessionId}`;

/** Membership fee due: amount, bank details and a link to the QR / card payment. */
export async function notifyFee(db: DB, orders: Pick<Order, "id" | "userId" | "amount" | "number" | "period">[]) {
  if (!orders.length) return 0;
  const map = await emails(db, orders.map((o) => o.userId));
  const account = (await getContent()).raw("massages.bankAccount").trim();
  let sent = 0;
  for (const o of orders) {
    const u = map.get(o.userId);
    if (!u) continue;
    await sendEmail(u.email, "membershipFee", {
      osloveni: greetName(u.name),
      mesic: o.period ? periodLabel(o.period) : "",
      castka: formatPrice(o.amount),
      ucet: account || "viz odkaz",
      vs: String(o.number ?? ""),
      odkaz: `${site.url}/platba/prevod?order=${o.id}`,
    });
    sent++;
  }
  return sent;
}

/** Warning / pause e-mail after a member's late cancellation or no-show. */
export async function notifyStrike(db: DB, userId: string, o: StrikeOutcome) {
  if (o.kind === "none") return;
  const u = (await emails(db, [userId])).get(userId);
  if (!u) return;
  if (o.kind === "warning")
    await sendEmail(u.email, "strikeWarning", {
      osloveni: greetName(u.name),
      pocet: String(o.strikes),
      limit: String(o.limit),
      dni: String(o.windowDays),
      pauza_dni: String(o.pauseDays),
    });
  else
    await sendEmail(u.email, "strikePause", { osloveni: greetName(u.name), do: formatDate(o.until), pauza_dni: String(o.pauseDays) });
}

/** `byStudio`: reception added the client – they always hear about it. */
export async function notifyBooked(db: DB, b: Pick<Booking, "userId" | "sessionId"> & Partial<Pick<Booking, "guestName">>, byStudio = false) {
  const u = (await emails(db, [b.userId])).get(b.userId);
  if (!u || (!byStudio && !u.bookingEmails)) return;
  await sendEmail(u.email, "booked", {
    osloveni: greetName(u.name),
    lekce: await describe(db, b.sessionId),
    kamaradka: b.guestName ? `Rezervovali jsme i místo pro kamarádku: ${b.guestName}.` : "",
    odkaz: link(b.sessionId),
  });
}

/** The client's own cancellation – skipped when they turned booking e-mails off. */
export async function notifyCancelled(db: DB, b: Pick<Booking, "userId" | "sessionId">, refunded: boolean) {
  const u = (await emails(db, [b.userId])).get(b.userId);
  if (!u || !u.bookingEmails) return;
  await sendEmail(u.email, "cancelled", {
    osloveni: greetName(u.name),
    lekce: await describe(db, b.sessionId),
    vraceni: refunded ? "Vstup/kredit ti vracíme na účet." : "Storno proběhlo po lhůtě, vstup propadá.",
  });
}

export async function notifyPromoted(db: DB, promoted: Pick<Booking, "userId" | "sessionId">[]) {
  const map = await emails(db, promoted.map((p) => p.userId));
  for (const p of promoted) {
    const u = map.get(p.userId);
    if (!u) continue;
    const lekce = await describe(db, p.sessionId);
    await sendEmail(u.email, "promoted", { osloveni: greetName(u.name), lekce, odkaz: link(p.sessionId) });
    await pushQuietly(db, [p.userId], { title: "Uvolnilo se místo – jdeš na lekci", body: lekce, url: link(p.sessionId) });
  }
}

export async function notifySessionCancelled(db: DB, sessionId: string, userIds: string[]) {
  const map = await emails(db, userIds);
  const what = await describe(db, sessionId);
  for (const id of userIds) {
    const u = map.get(id);
    if (!u) continue;
    await sendEmail(u.email, "sessionCancelled", { osloveni: greetName(u.name), lekce: what, odkaz: `${site.url}/rozvrh` });
  }
  await pushQuietly(db, userIds, { title: "Lekce je zrušená", body: what, url: `${site.url}/rozvrh` });
}
