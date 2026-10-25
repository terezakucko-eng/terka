import { eq, inArray } from "drizzle-orm";
import { sessionName } from "./session-name";
import type { DB } from "@/db";
import { classSessions, classTypes, orders, users, type Booking, type Order, type Wish } from "@/db/schema";
import { site } from "@/config/site";
import type { StrikeOutcome } from "@/domain/strikes";
import { periodLabel } from "@/domain/membership-fees";
import { getContent } from "@/content";
import { credits, formatPrice } from "./money";
import { formatDate, formatDay, formatTime, pragueHour } from "./dates";
import { sendEmail } from "./email-templates";
import { greetName } from "@/lib/vocative";
import { pushQuietly } from "./push";
import { sendMail } from "./mail";
import { WISH_KINDS } from "@/domain/wishes";
import { dueGreetings, dueWinbacks, greetBirthday, markNameDay, markWinback } from "@/domain/greetings";
import { markAnnounced, unannouncedRewards } from "@/domain/referrals";
import { markBookingAnnounced, markExpiryAnnounced, markSignUpAnnounced, unannouncedBookings, unannouncedExpiries, unannouncedSignUps } from "@/domain/pass-cards";
import { formatVoucherCode, markVoucherNotified, unnotifiedVouchers } from "@/domain/vouchers";
import { displayName } from "./profile";
import { expireStalePending, fillFromWaitlist, markLapseAnnounced, markTransferNotice, releasedHoldsWithWaitlist, transfersToCheck, unannouncedLapses } from "@/domain/booking";
import type { fulfillOrder } from "@/domain/orders";
import { getSettings } from "./settings";
import { unsubscribeUrl } from "./links";

async function describe(db: DB, sessionId: string) {
  const [row] = await db
    .select({ s: classSessions, ct: classTypes })
    .from(classSessions)
    .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
    .where(eq(classSessions.id, sessionId));
  return `${sessionName(row.s, row.ct)} – ${formatDay(row.s.startsAt)} v ${formatTime(row.s.startsAt)}`;
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
    kalendar: `${site.url}/api/kalendar/lekce/${b.sessionId}`,
  });
}

const when = (d: Date) => `${formatDay(d)} v ${formatTime(d)}`;

/** A drop-in by transfer waits for its payment: bank details, QR link and until when the place is held. */
export async function notifyAwaitingPayment(db: DB, o: Pick<Order, "id" | "userId" | "sessionId" | "amount" | "number" | "expiresAt">) {
  const u = (await emails(db, [o.userId])).get(o.userId);
  if (!u || !o.sessionId || !o.expiresAt) return;
  await sendEmail(u.email, "bookedPending", {
    osloveni: greetName(u.name),
    lekce: await describe(db, o.sessionId),
    platnost: when(o.expiresAt),
    castka: formatPrice(o.amount),
    ucet: (await getContent()).raw("massages.bankAccount").trim() || "viz odkaz",
    vs: String(o.number ?? ""),
    odkaz: `${site.url}/platba/prevod?order=${o.id}`,
  });
}

/** After a payment: a drop-in's place is confirmed now – or came back as credit when it was gone. */
export async function notifyPaid(db: DB, r: Awaited<ReturnType<typeof fulfillOrder>>) {
  if (!r.dropIn) return;
  const { booking: b, outcome } = r.dropIn;
  const lekce = await describe(db, b.sessionId);
  if (outcome === "confirmed") {
    await notifyBooked(db, b, true);
    await pushQuietly(db, [b.userId], { title: "Platba dorazila – místo je tvoje", body: lekce, url: link(b.sessionId) });
    return;
  }
  const u = (await emails(db, [b.userId])).get(b.userId);
  const [row] = await db.select({ cost: classSessions.creditCost }).from(classSessions).where(eq(classSessions.id, b.sessionId));
  if (u)
    await sendEmail(u.email, "dropInLate", {
      osloveni: greetName(u.name),
      lekce,
      kredit: credits((row?.cost ?? 0) * b.seats),
      odkaz: `${site.url}/rozvrh`,
    });
  await pushQuietly(db, [b.userId], { title: "Platba dorazila pozdě – máš ji jako kredit", body: lekce, url: `${site.url}/ucet` });
}

/**
 * Drop-ins by transfer that weren't paid in time give their place up (run by
 * the 15-minute cron): the client hears about it and the waitlist moves up.
 */
export async function releaseUnpaidDropIns(db: DB, now = new Date()) {
  await db.transaction((tx) => expireStalePending(tx, now));
  const lapses = await unannouncedLapses(db, now);
  const map = await emails(db, lapses.map((l) => l.userId));
  for (const l of lapses) {
    try {
      const lekce = await describe(db, l.sessionId!);
      const u = map.get(l.userId);
      const [o] = await db.select({ expiresAt: orders.expiresAt }).from(orders).where(eq(orders.id, l.orderId));
      if (u) await sendEmail(u.email, "dropInLapsed", { osloveni: greetName(u.name), lekce, platnost: when(o.expiresAt!), odkaz: `${site.url}/rozvrh` });
      await pushQuietly(db, [l.userId], { title: "Rezervace propadla – platba nedorazila", body: lekce, url: link(l.sessionId!) });
      await pushQuietly(db, await adminIds(db), {
        title: "⌛ Převod nedorazil – místo je uvolněné",
        body: `${u?.name ?? "Klient"} · ${lekce}`,
        url: `${site.url}/admin/rozvrh/${l.sessionId}`,
      });
      await markLapseAnnounced(db, l.orderId, now);
      await notifyPromoted(db, await fillFromWaitlist(db, l.sessionId!, now));
    } catch {
      // the next run tries again
    }
  }
  return lapses.length;
}

const adminIds = async (db: DB) => (await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"))).map((a) => a.id);

/**
 * The studio checks transfers by hand: a push when a drop-in starts waiting for
 * one, and again about 2 h before its place would lapse (not at night).
 */
export async function sendTransferChecks(db: DB, now = new Date()) {
  const hour = pragueHour(now);
  if (hour < 7 || hour >= 22) return 0;
  const checks = await transfersToCheck(db, now);
  if (!checks.length) return 0;
  const admins = await adminIds(db);
  let sent = 0;
  for (const t of checks) {
    const what = `${t.userName} · ${t.name} ${formatDay(t.startsAt)} v ${formatTime(t.startsAt)} · ${formatPrice(t.amount)}, VS ${t.number}`;
    const url = `${site.url}/admin/rozvrh/${t.sessionId}`;
    if (!t.remindedAt && t.expiresAt!.getTime() - now.getTime() <= 2 * 3_600_000) {
      await markTransferNotice(db, t.orderId, "reminder", now);
      if (!t.notifiedAt) await markTransferNotice(db, t.orderId, "new", now);
      await pushQuietly(db, admins, { title: `⏰ Zkontroluj převod – místo propadne v ${formatTime(t.expiresAt!)}`, body: what, url });
      sent++;
    } else if (!t.notifiedAt) {
      await markTransferNotice(db, t.orderId, "new", now);
      await pushQuietly(db, admins, { title: `💸 Čeká převod – potvrď do ${when(t.expiresAt!)}`, body: what, url });
      sent++;
    }
  }
  return sent;
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

/**
 * Places held for non-members (e.g. one Reformer place) are released a week
 * before the class – whoever waits on the waitlist gets them now and an
 * e-mail. Run by the 15-minute cron.
 */
export async function fillReleasedPlaces(db: DB, now = new Date()) {
  let n = 0;
  for (const id of await releasedHoldsWithWaitlist(db, now)) {
    try {
      const promoted = await fillFromWaitlist(db, id, now);
      await notifyPromoted(db, promoted);
      n += promoted.length;
    } catch {
      // the next run tries again
    }
  }
  return n;
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

/** A new message in the Schránka přání a nápadů: push to the admins, e-mail to the studio. */
export async function notifyNewWish(db: DB, w: Wish) {
  const k = WISH_KINDS[w.kind];
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
  const url = `${site.url}/admin/schranka`;
  await pushQuietly(db, admins.map((a) => a.id), { title: `💌 ${k.label}`, body: w.body.slice(0, 140), url });
  const c = await getContent();
  await sendMail({
    to: c.raw("site.email"),
    subject: `💌 Schránka přání a nápadů: ${k.label}`,
    text: [
      `${k.emoji} ${k.label} – ${w.anonymous ? "anonymně" : (w.signature ?? "")}`,
      "",
      w.body,
      "",
      w.allowPublic ? "Klient souhlasí, že vzkaz může být na webu (zveřejníš ho v adminu)." : "Jen pro studio – klient si nepřeje zveřejnění.",
      "",
      `Odpovědět: ${url}`,
    ].join("\n"),
  });
}

/** The studio replied – e-mail and push to the client (also for anonymous messages; only the studio doesn't see who). */
export async function notifyWishReply(db: DB, w: Wish) {
  const [u] = await db.select().from(users).where(eq(users.id, w.userId));
  if (!u || u.deletedAt || !w.reply) return;
  const odkaz = `${site.url}/ucet/schranka`;
  await sendEmail(u.email, "wishReply", { osloveni: greetName(u.name), vzkaz: w.body, odpoved: w.reply, odkaz });
  await pushQuietly(db, [u.id], { title: "💌 Odpověď na tvůj vzkaz", body: w.reply.slice(0, 140), url: odkaz });
}

/**
 * Birthday (with the gift) and name-day greetings – e-mail and push, once a
 * year each – and a push to the studio with who celebrates today.
 */
export async function sendGreetings(db: DB, now = new Date()) {
  const cfg = await getSettings(db);
  if (!cfg.birthdayGreetings) return { birthdays: 0, nameDays: 0 };
  const { year, birthdays, nameDays } = await dueGreetings(db, now);
  const today = new Map<string, { name: string; what: string[] }>();
  const note = (u: { id: string; name: string }, what: string) =>
    today.set(u.id, { name: u.name, what: [...(today.get(u.id)?.what ?? []), what] });
  let sentBirthdays = 0;
  let sentNameDays = 0;
  for (const u of birthdays) {
    const gift = await greetBirthday(db, u.id, year, cfg, now);
    if (gift === false) continue;
    note(u, "narozeniny");
    await sendEmail(u.email, "birthday", {
      osloveni: greetName(u.name),
      darek: gift ? `Na účtu máš od nás dárek – lekci zdarma, platí do ${formatDate(gift)}. Vyber si ji v rozvrhu: ${site.url}/rozvrh` : "",
    });
    await pushQuietly(db, [u.id], {
      title: "Všechno nejlepší! 🎂",
      body: gift ? "Na účtu tě čeká dárek – lekce zdarma." : "Přejeme ti krásné narozeniny.",
      url: `${site.url}/ucet`,
    });
    sentBirthdays++;
  }
  const celebrating = new Set(birthdays.map((u) => u.id));
  for (const u of nameDays) {
    if (!(await markNameDay(db, u.id, year))) continue;
    note(u, "svátek");
    // on a birthday the birthday wishes are enough
    if (celebrating.has(u.id)) continue;
    await sendEmail(u.email, "nameDay", { osloveni: greetName(u.name) });
    await pushQuietly(db, [u.id], { title: "Krásný svátek! 🌷", body: "Přejeme ti krásný den.", url: `${site.url}/rozvrh` });
    sentNameDays++;
  }
  if (today.size) {
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
    const list = [...today.entries()];
    await pushQuietly(db, admins.map((a) => a.id), {
      title: list.some(([, c]) => c.what.includes("narozeniny")) ? "🎂 Dnes slaví" : "🌷 Dnes má svátek",
      body: list.map(([, c]) => `${c.name} – ${c.what.join(" a ")}`).join(", "),
      url: list.length === 1 ? `${site.url}/admin/klienti/${list[0][0]}` : `${site.url}/admin`,
    });
  }
  return { birthdays: sentBirthdays, nameDays: sentNameDays };
}

/** „Chybíš nám“ to clients who haven't been to a lesson for a while (news consent only). */
export async function sendWinbacks(db: DB, now = new Date()) {
  const cfg = await getSettings(db);
  let sent = 0;
  for (const u of await dueWinbacks(db, cfg.winbackDays, now)) {
    await markWinback(db, u.id, now);
    await sendEmail(u.email, "winback", { osloveni: greetName(u.name), odkaz: `${site.url}/rozvrh`, odhlasit: unsubscribeUrl(u.token) });
    sent++;
  }
  return sent;
}

/** Thanks the client whose invited friend paid for the first time (the gift is already on the account). */
export async function sendReferralThanks(db: DB, now = new Date()) {
  const due = await unannouncedRewards(db);
  if (!due.length) return 0;
  const people = await db
    .select({ id: users.id, email: users.email, name: users.name, nickname: users.nickname })
    .from(users)
    .where(inArray(users.id, [...new Set(due.flatMap(({ r }) => [r.referrerId, r.friendId]))]));
  const byId = new Map(people.map((p) => [p.id, p]));
  let sent = 0;
  for (const { r, until } of due) {
    await markAnnounced(db, r.id, now);
    const who = byId.get(r.referrerId);
    const friend = byId.get(r.friendId);
    if (!who || !until) continue;
    await sendEmail(who.email, "referralReward", {
      osloveni: greetName(who.name),
      kamaradka: friend ? displayName(friend) : "Tvoje kamarádka",
      platnost: formatDate(until),
      odkaz: `${site.url}/rozvrh`,
    });
    await pushQuietly(db, [who.id], { title: "Díky za pozvání! 💛", body: "Na účtu máš lekci zdarma.", url: `${site.url}/ucet` });
    sent++;
  }
  return sent;
}

/** Pošli to dál: the studio hears about every sign-up and every lesson booked with a card, and about cards that expired. */
export async function sendPassCardNotices(db: DB, now = new Date()) {
  const admins = (await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"))).map((a) => a.id);
  let sent = 0;
  for (const r of await unannouncedSignUps(db)) {
    await markSignUpAnnounced(db, r.use.id, now);
    await pushQuietly(db, admins, {
      title: `💛 ${r.label}: nová registrace`,
      body: `${r.userName}${r.fromName ? ` (po ${r.fromName})` : ""} – ${r.use.rechargedAt ? "kartička jde dál, má zase 2 místa" : "na kartičce zbývá 1 místo"}.`,
      url: `${site.url}/admin/klienti/${r.use.userId}`,
    });
    sent++;
  }
  for (const r of await unannouncedBookings(db)) {
    await markBookingAnnounced(db, r.use.id, now);
    await pushQuietly(db, admins, {
      title: `📅 ${r.label}: rezervace přes kartičku`,
      body: `${r.userName} – ${r.lesson.name} ${formatDay(r.lesson.startsAt)} v ${formatTime(r.lesson.startsAt)}`,
      url: `${site.url}/admin/rozvrh/${r.lesson.sessionId}`,
    });
    sent++;
  }
  for (const c of await unannouncedExpiries(db, now)) {
    await markExpiryAnnounced(db, c.id, now);
    await pushQuietly(db, admins, {
      title: `⌛ ${c.label} propadla`,
      body: "Měsíc ji nikdo nevyužil. V adminu ji můžeš obnovit, nebo vyřadit.",
      url: `${site.url}/admin/karticky`,
    });
    sent++;
  }
  return sent;
}

/** Tells the buyer their gift voucher is paid and ready to download. */
export async function sendVoucherReady(db: DB, now = new Date()) {
  let sent = 0;
  for (const { v, email, name } of await unnotifiedVouchers(db)) {
    await markVoucherNotified(db, v.id, now);
    await sendEmail(email, "voucherReady", {
      osloveni: greetName(name),
      poukaz: v.title,
      odkaz: `${site.url}/api/poukaz/${v.id}`,
      kod: formatVoucherCode(v.code),
      platnost: v.validUntil ? formatDate(v.validUntil) : "",
      uplatneni: `${site.url}/poukaz`,
    });
    sent++;
  }
  return sent;
}

/** A client ended a membership without commitment – the studio hears about it. */
/** A member switched to a higher membership (e.g. Členství Reformer) – the studio gets a push and an e-mail. */
export async function notifyMembershipSwitched(db: DB, u: { id: string; name: string; email: string }, change: { from: string; to: string; price: number; since: string }) {
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
  const url = `${site.url}/admin/klienti/${u.id}`;
  await pushQuietly(db, admins.map((a) => a.id), { title: "Změna členství", body: `${u.name} – ${change.to} od ${change.since}`, url });
  const c = await getContent();
  await sendMail({
    to: c.raw("site.email"),
    subject: `Změna členství: ${u.name} → ${change.to}`,
    text: [
      `${u.name} (${u.email}) přešel/přešla z „${change.from}“ na „${change.to}“.`,
      `Platí od ${change.since}, měsíční platba od té doby ${formatPrice(change.price)}.`,
      "",
      `Detail klienta: ${url}`,
    ].join("\n"),
  });
}

export async function notifyMembershipEnded(db: DB, u: { id: string; name: string; email: string }, lastDay: Date) {
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
  const url = `${site.url}/admin/klienti/${u.id}`;
  await pushQuietly(db, admins.map((a) => a.id), { title: "Ukončené členství", body: `${u.name} – platí do ${formatDate(lastDay)}`, url });
  const c = await getContent();
  await sendMail({
    to: c.raw("site.email"),
    subject: `Členství bez závazku ukončeno: ${u.name}`,
    text: [`${u.name} (${u.email}) si ukončil/a členství bez závazku.`, `Platí do ${formatDate(lastDay)}, další měsíční platby už nepřijdou.`, "", `Detail klienta: ${url}`].join("\n"),
  });
}
