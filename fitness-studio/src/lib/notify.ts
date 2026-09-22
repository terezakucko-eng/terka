import { eq, inArray } from "drizzle-orm";
import type { DB } from "@/db";
import { classSessions, classTypes, users, type Booking } from "@/db/schema";
import { site } from "@/config/site";
import { formatDay, formatTime } from "./dates";
import { sendMail } from "./mail";

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

export async function notifyBooked(db: DB, b: Pick<Booking, "userId" | "sessionId">) {
  const u = (await emails(db, [b.userId])).get(b.userId);
  if (!u) return;
  await sendMail({
    to: u.email,
    subject: `Rezervace potvrzena: ${await describe(db, b.sessionId)}`,
    text: `Ahoj ${u.name},\n\nmáš místo na lekci ${await describe(db, b.sessionId)}.\nDetail a případné storno: ${link(b.sessionId)}\n\nTěšíme se!`,
  });
}

export async function notifyCancelled(db: DB, b: Pick<Booking, "userId" | "sessionId">, refunded: boolean) {
  const u = (await emails(db, [b.userId])).get(b.userId);
  if (!u) return;
  await sendMail({
    to: u.email,
    subject: `Rezervace zrušena: ${await describe(db, b.sessionId)}`,
    text: `Ahoj ${u.name},\n\ntvoje rezervace na ${await describe(db, b.sessionId)} byla zrušena.\n${
      refunded ? "Vstup/kredit ti vracíme na účet." : "Storno proběhlo po lhůtě, vstup propadá."
    }`,
  });
}

export async function notifyPromoted(db: DB, promoted: Pick<Booking, "userId" | "sessionId">[]) {
  const map = await emails(db, promoted.map((p) => p.userId));
  for (const p of promoted) {
    const u = map.get(p.userId);
    if (!u) continue;
    await sendMail({
      to: u.email,
      subject: `Uvolnilo se místo! ${await describe(db, p.sessionId)}`,
      text: `Ahoj ${u.name},\n\nz pořadníku ses dostal/a na lekci ${await describe(db, p.sessionId)}. Rezervace je potvrzená.\nKdybys nemohl/a, zruš ji prosím: ${link(p.sessionId)}`,
    });
  }
}

export async function notifySessionCancelled(db: DB, sessionId: string, userIds: string[]) {
  const map = await emails(db, userIds);
  const what = await describe(db, sessionId);
  for (const id of userIds) {
    const u = map.get(id);
    if (!u) continue;
    await sendMail({
      to: u.email,
      subject: `Lekce zrušena: ${what}`,
      text: `Ahoj ${u.name},\n\nomlouváme se, lekce ${what} se nekoná. Vstup/kredit jsme ti vrátili na účet.\nVyber si jinou lekci: ${site.url}/rozvrh`,
    });
  }
}
