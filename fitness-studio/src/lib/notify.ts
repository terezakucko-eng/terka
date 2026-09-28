import { eq, inArray } from "drizzle-orm";
import type { DB } from "@/db";
import { classSessions, classTypes, users, type Booking } from "@/db/schema";
import { site } from "@/config/site";
import { formatDay, formatTime } from "./dates";
import { sendEmail } from "./email-templates";
import { greetName } from "@/lib/vocative";

async function describe(db: DB, sessionId: string) {
  const [row] = await db
    .select({ s: classSessions, ct: classTypes })
    .from(classSessions)
    .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
    .where(eq(classSessions.id, sessionId));
  return `${row.ct.name} – ${formatDay(row.s.startsAt)} v ${formatTime(row.s.startsAt)}`;
}

async function emails(db: DB, ids: string[]) {
  if (!ids.length) return new Map<string, { email: string; name: string }>();
  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(inArray(users.id, ids));
  return new Map(rows.map((r) => [r.id, r]));
}

const link = (sessionId: string) => `${site.url}/rozvrh/${sessionId}`;

export async function notifyBooked(db: DB, b: Pick<Booking, "userId" | "sessionId"> & Partial<Pick<Booking, "guestName">>) {
  const u = (await emails(db, [b.userId])).get(b.userId);
  if (!u) return;
  await sendEmail(u.email, "booked", {
    osloveni: greetName(u.name),
    lekce: await describe(db, b.sessionId),
    kamaradka: b.guestName ? `Rezervovali jsme i místo pro kamarádku: ${b.guestName}.` : "",
    odkaz: link(b.sessionId),
  });
}

export async function notifyCancelled(db: DB, b: Pick<Booking, "userId" | "sessionId">, refunded: boolean) {
  const u = (await emails(db, [b.userId])).get(b.userId);
  if (!u) return;
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
    await sendEmail(u.email, "promoted", {
      osloveni: greetName(u.name),
      lekce: await describe(db, p.sessionId),
      odkaz: link(p.sessionId),
    });
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
}
