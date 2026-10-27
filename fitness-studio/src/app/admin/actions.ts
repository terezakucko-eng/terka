"use server";

import { htmlToText, toSafeHtml } from "@/lib/rich-html";
import { and, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, type DB } from "@/db";
import {
  announcements,
  classSessions,
  classTypes,
  entitlements,
  instructors,
  orders,
  products,
  pushSubscriptions,
  users,
  type ClassSession,
} from "@/db/schema";
import {
  adminAddBooking,
  bookingOptions,
  type AdminPay,
  type Method,
  cancelBooking,
  bookingOfOrder,
  cancelSession,
  fillFromWaitlist,
  holdSeats,
  occupancy,
  setAttendance,
  setSurchargePaid,
} from "@/domain/booking";
import { deleteClassType, deleteProduct } from "@/domain/catalog";
import { LESSON_TEMPLATES, templateFor } from "@/domain/lesson-templates";
import { setDraftHidden } from "@/domain/lesson-drafts";
import { deleteClient, deleteClients, deleteOrder, deleteOrders, purgeSession, seriesFrom } from "@/domain/cleanup";
import { cancelOrder, fulfillOrder, paidLateOk, sellAtReception } from "@/domain/orders";
import { deductSolarium } from "@/domain/solarium";
import { deleteStudentProof } from "@/domain/students";
import { createClientByStudio, grantEntitlement, normalizeEmail } from "@/domain/users";
import { sendEmail } from "@/lib/email-templates";
import { createPasswordLink } from "@/lib/password-links";
import { greetName } from "@/lib/vocative";
import { changeCredits } from "@/domain/wallet";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { addDays, dateKey, formatDate, formatDay, mondayOf, pragueLocalToDate, weekdayOf, isDateKey } from "@/lib/dates";
import { UserError } from "@/lib/errors";
import { attempt, field, type FormState } from "@/lib/form";
import { cancelledRecipients, notifyBooked, notifyCancelled, notifyPaid, notifyPromoted, notifySessionCancelled, notifySessionMoved, notifyStrike, remindPayment } from "@/lib/notify";
import { afterMemberStrike, clearPause, reconsiderPause } from "@/domain/strikes";
import { storeImage, uploadedFile } from "@/lib/media";
import { credits, formatPrice } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";
import { defaultSettings, getSettings, saveSettings, type Settings } from "@/lib/settings";
import { cancelEntitlement, followMonthlyFee, isPeriod, periodLabel } from "@/domain/membership-fees";
import { cleanBirthDate, cleanNameDay } from "@/lib/profile";
import { videoEmbedUrl } from "@/lib/video";
import { pushQuietly } from "@/lib/push";
import { site } from "@/config/site";

const done = (msg?: string) => {
  revalidatePath("/", "layout");
  return msg;
};

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/** Uploaded file wins; `remove` checkbox clears; otherwise field untouched. */
async function imageField<K extends string>(fd: FormData, fileName: string, removeName: string | null, key: K) {
  const file = uploadedFile(fd, fileName);
  if (file) return { [key]: await storeImage(await getDb(), file, 1600) } as Record<K, string>;
  if (removeName && field.bool(fd, removeName)) return { [key]: null } as Record<K, null>;
  return {};
}

function videoField(v: string) {
  if (!v) return null;
  if (!videoEmbedUrl(v)) throw new UserError("Videoukázka: vlož odkaz na YouTube nebo Vimeo.");
  return v;
}

function required<T>(v: T | null | undefined, msg: string): T {
  if (v === null || v === undefined || v === "") throw new UserError(msg);
  return v;
}

/* ------------------------------------------------------------ catalogue */

export async function saveClassTypeAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const db = await getDb();
    const name = required(field.str(fd, "name"), "Vyplň název.");
    const cancelHours = field.int(fd, "cancellationHours");
    const values = {
      name,
      slug: field.str(fd, "slug") || slugify(name),
      description: field.str(fd, "description"),
      keywords: field.str(fd, "keywords").slice(0, 500),
      durationMin: field.int(fd, "durationMin") ?? 60,
      capacity: field.int(fd, "capacity") ?? 12,
      creditCost: field.int(fd, "creditCost") ?? 1,
      dropInPrice: field.money(fd, "dropInPrice"),
      color: field.str(fd, "color") || "#D2A772",
      level: field.str(fd, "level") || "Pro všechny",
      memberSurcharge: field.money(fd, "memberSurcharge") || null,
      memberSurchargeFrom: isDateKey(field.str(fd, "memberSurchargeFrom")) ? field.str(fd, "memberSurchargeFrom") : null,
      // a new price from a date (next year's price list); empty date = no change planned
      memberSurchargeNext: isDateKey(field.str(fd, "memberSurchargeNextFrom")) ? (field.money(fd, "memberSurchargeNext") ?? 0) : null,
      memberSurchargeNextFrom: isDateKey(field.str(fd, "memberSurchargeNextFrom")) ? field.str(fd, "memberSurchargeNextFrom") : null,
      nonMemberSeats: Math.max(0, field.int(fd, "nonMemberSeats") ?? 0),
      nonMemberReleaseHours: Math.max(0, field.int(fd, "nonMemberReleaseHours") ?? 168),
      // empty = the default from Nastavení
      cancellationHours: cancelHours === null ? null : Math.max(0, cancelHours),
      priceNote: field.str(fd, "priceNote").slice(0, 120),
      priceNoteUntil: isDateKey(field.str(fd, "priceNoteUntil")) ? field.str(fd, "priceNoteUntil") : null,
      passSurcharge: field.money(fd, "passSurcharge") || null,
      firstVisitPrice: field.money(fd, "firstVisitPrice"),
      firstVisitNewOnly: field.bool(fd, "firstVisitNewOnly"),
      duoPrice: field.money(fd, "duoPrice"),
      studentDropInPrice: field.money(fd, "studentDropInPrice"),
      noFreeEntry: field.bool(fd, "noFreeEntry"),
      noPass: field.bool(fd, "noPass"),
      passEntries: Math.max(1, field.int(fd, "passEntries") ?? 1),
      videoUrl: videoField(field.str(fd, "videoUrl")),
      sortOrder: field.int(fd, "sortOrder") ?? 0,
      isActive: field.bool(fd, "isActive"),
      ...(await imageField(fd, "image", "removeImage", "imageUrl")),
    };
    const id = field.str(fd, "id");
    if (id) await db.update(classTypes).set(values).where(eq(classTypes.id, id));
    else await db.insert(classTypes).values(values);
    return done(id ? "Lekce uložena." : "Lekce vytvořena.");
  });
}

/** Admin → Lekce: a ready-made lesson, created hidden so its page can be prepared before going public. */
export async function lessonFromTemplateAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const tpl = LESSON_TEMPLATES.find((t) => t.slug === field.str(fd, "slug"));
    if (!tpl) throw new UserError("Návrh nenalezen.");
    const db = await getDb();
    const existing = await db.select({ slug: classTypes.slug, name: classTypes.name }).from(classTypes).where(isNull(classTypes.archivedAt));
    const same = existing.find((c) => templateFor(c) === tpl);
    if (same) throw new UserError(`Lekce „${same.name}“ už existuje – použij u ní „Doplnit popis z návrhu“.`);
    await db.insert(classTypes).values({
      name: tpl.name,
      slug: tpl.slug,
      description: tpl.description,
      keywords: tpl.keywords,
      level: tpl.level ?? "Pro všechny",
      durationMin: tpl.durationMin ?? 60,
      ...(tpl.capacity ? { capacity: tpl.capacity } : {}),
      isActive: false,
      sortOrder: 100,
    });
    return done(`${tpl.name} je připravená jako neaktivní – doplň cenu a fotku, pak ji zapni.`);
  });
}

/** Admin → Lekce: an existing lesson takes a draft's description and search terms (name, prices and schedule stay). */
export async function lessonTextFromTemplateAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const tpl = LESSON_TEMPLATES.find((t) => t.slug === field.str(fd, "template"));
    if (!tpl) throw new UserError("Vyber návrh.");
    const id = required(field.str(fd, "id"), "Chybí lekce.");
    await (await getDb()).update(classTypes).set({ description: tpl.description, keywords: tpl.keywords }).where(eq(classTypes.id, id));
    return done(`Popis a hledané výrazy z návrhu „${tpl.name}“ jsou doplněné – klidně je ještě uprav.`);
  });
}

/** Admin → Lekce: hide a draft from "Připravené návrhy lekcí" (or bring it back). */
export async function hideLessonDraftAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const slug = field.str(fd, "slug");
    if (!LESSON_TEMPLATES.some((t) => t.slug === slug)) throw new UserError("Návrh nenalezen.");
    await setDraftHidden(await getDb(), slug, field.str(fd, "do") !== "show");
    return done();
  });
}

export async function deleteClassTypeAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const result = await deleteClassType(await getDb(), required(field.str(fd, "id"), "Chybí lekce."));
    return done(
      result === "deleted"
        ? "Typ lekce smazán."
        : "Typ lekce smazán. Proběhlé termíny s rezervacemi zůstávají v historii klientů.",
    );
  });
}

export async function saveInstructorAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const db = await getDb();
    const name = required(field.str(fd, "name"), "Vyplň jméno.");
    const values = {
      name,
      slug: field.str(fd, "slug") || slugify(name),
      specialties: field.str(fd, "specialties"),
      bio: field.str(fd, "bio"),
      photoUrl: field.optional(fd, "photoUrl"),
      ...(await imageField(fd, "photo", null, "photoUrl")),
      sortOrder: field.int(fd, "sortOrder") ?? 0,
      isActive: field.bool(fd, "isActive"),
    };
    const id = field.str(fd, "id");
    if (id) await db.update(instructors).set(values).where(eq(instructors.id, id));
    else await db.insert(instructors).values(values);
    return done("Lektor uložen.");
  });
}

export async function deleteProductAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const r = await deleteProduct(await getDb(), required(field.str(fd, "id"), "Chybí produkt."));
    return done(
      r === "deleted"
        ? "Produkt smazán."
        : "Produkt smazán z ceníku. Kdo ho už koupil, má ho dál platný.",
    );
  });
}

export async function saveProductAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const db = await getDb();
    const kind = field.str(fd, "kind") as "credit_pack" | "pass" | "membership" | "solarium" | "massage_pass";
    if (!["credit_pack", "pass", "membership", "solarium", "massage_pass"].includes(kind)) throw new UserError("Vyber typ.");
    const values = {
      kind,
      name: required(field.str(fd, "name"), "Vyplň název."),
      description: field.str(fd, "description"),
      price: required(field.money(fd, "price"), "Vyplň cenu."),
      credits: kind === "credit_pack" ? required(field.int(fd, "credits"), "Vyplň počet kreditů.") : null,
      entries: kind === "credit_pack" ? null : field.int(fd, "entries"),
      validityDays: kind === "credit_pack" ? field.int(fd, "validityDays") : (field.int(fd, "validityDays") ?? 30),
      weeklyLimit: kind === "membership" ? field.int(fd, "weeklyLimit") : null,
      commitmentMonths: kind === "membership" ? (field.int(fd, "commitmentMonths") ?? 12) : 12,
      includedClassTypeId: kind === "membership" ? field.str(fd, "includedClassTypeId") || null : null,
      includedPerMonth: kind === "membership" && field.str(fd, "includedClassTypeId") ? Math.max(0, field.int(fd, "includedPerMonth") ?? 0) : 0,
      maxActive: kind === "membership" ? field.int(fd, "maxActive") : null,
      saleFrom: startOfDay(field.str(fd, "saleFrom")),
      saleUntil: startOfDay(field.str(fd, "saleUntil")),
      presaleFrom: startOfDay(field.str(fd, "presaleFrom")),
      recurring: kind === "membership" && field.bool(fd, "recurring"),
      highlight: field.bool(fd, "highlight"),
      linkOnly: field.bool(fd, "linkOnly"),
      membersOnly: field.bool(fd, "membersOnly"),
      studentsOnly: field.bool(fd, "studentsOnly"),
      isActive: field.bool(fd, "isActive"),
      sortOrder: field.int(fd, "sortOrder") ?? 0,
      massageServiceId: kind === "massage_pass" ? field.str(fd, "massageServiceId") || null : null,
    };
    if (kind === "massage_pass" && !values.entries) throw new UserError("Vyplň počet masáží na permanentce.");
    if (kind === "pass" && !values.entries) throw new UserError("Permanentka potřebuje počet vstupů.");
    if (kind === "solarium" && !values.entries) throw new UserError("Vyplň počet minut solária.");
    const id = field.str(fd, "id");
    if (id) await db.update(products).set(values).where(eq(products.id, id));
    else await db.insert(products).values(values);
    return done("Produkt uložen.");
  });
}

export async function saveAnnouncementAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const db = await getDb();
    const values = {
      title: required(field.str(fd, "title"), "Vyplň nadpis."),
      body: required(toSafeHtml(field.str(fd, "body")), "Vyplň text."),
      isPinned: field.bool(fd, "isPinned"),
      isPublished: field.bool(fd, "isPublished"),
    };
    let id = field.str(fd, "id");
    if (id) await db.update(announcements).set(values).where(eq(announcements.id, id));
    else id = (await db.insert(announcements).values(values).returning({ id: announcements.id }))[0].id;
    if (!values.isPublished || !field.bool(fd, "notify")) return done("Aktualita uložena.");
    // push to everyone who turned notifications on, opening the post on the board
    const ids = [...new Set((await db.select({ userId: pushSubscriptions.userId }).from(pushSubscriptions)).map((r) => r.userId))];
    if (!ids.length) return done("Aktualita uložena. Upozornění si zatím nikdo nezapnul.");
    const sent = await pushQuietly(db, ids, {
      title: values.title.slice(0, 80),
      body: htmlToText(values.body) || "Novinka na nástěnce",
      url: `${site.url}/nastenka#${id}`,
    });
    return done(sent ? `Aktualita uložena a upozornění odešlo (příjemců: ${ids.length}).` : "Aktualita uložena, upozornění se ale nepodařilo odeslat.");
  });
}

export async function deleteAnnouncementAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    await (await getDb()).delete(announcements).where(eq(announcements.id, field.str(fd, "id")));
    return done("Smazáno.");
  });
}

export async function saveSettingsAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const values: Partial<Settings> = {};
    for (const key of Object.keys(defaultSettings) as (keyof Settings)[]) {
      const v = field.int(fd, key);
      if (v === null || v < 0) throw new UserError("Hodnoty musí být nezáporná čísla.");
      values[key] = v;
    }
    if (values.pendingPaymentMinutes! < 30)
      throw new UserError("Čekání na platbu musí být alespoň 30 minut (limit Stripe).");
    await saveSettings(await getDb(), values);
    return done("Nastavení uloženo.");
  });
}

/* ------------------------------------------------------------- schedule */

async function sessionValues(fd: FormData) {
  const db = await getDb();
  const [ct] = await db
    .select()
    .from(classTypes)
    .where(eq(classTypes.id, required(field.str(fd, "classTypeId"), "Vyber lekci.")));
  if (!ct) throw new UserError("Lekce neexistuje.");
  const isFree = field.bool(fd, "isFree");
  return {
    ct,
    values: {
      classTypeId: ct.id,
      instructorId: field.optional(fd, "instructorId"),
      durationMin: field.int(fd, "durationMin") ?? ct.durationMin,
      capacity: field.int(fd, "capacity") ?? ct.capacity,
      creditCost: field.int(fd, "creditCost") ?? ct.creditCost,
      dropInPrice: isFree ? null : (field.money(fd, "dropInPrice") ?? ct.dropInPrice),
      isFree,
      room: field.optional(fd, "room"),
      title: field.optional(fd, "title"),
      note: field.optional(fd, "note"),
      bookingOpensAt: opensAtFrom(fd),
    },
  };
}

/** "Rezervace otevřít od" – empty = the usual booking window. */
function opensAtFrom(fd: FormData) {
  const local = field.str(fd, "bookingOpensAt");
  if (!local) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new UserError("Neplatné datum otevření rezervací.");
  return pragueLocalToDate(local);
}

/** Booking that "opens" at or after the start would never open – refuse it. */
function checkOpensBefore(opensAt: Date | null, starts: Date[]) {
  if (opensAt && starts.some((s) => opensAt >= s))
    throw new UserError("„Rezervace otevřít od“ musí být před začátkem lekce. Když ho nepotřebuješ, nech ho prázdné.");
}

export async function createSessionsAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const { values } = await sessionValues(fd);
    const from = field.str(fd, "dateFrom");
    const time = field.str(fd, "time");
    if (!isDateKey(from) || !/^\d{2}:\d{2}$/.test(time)) throw new UserError("Vyplň datum a čas.");
    const until = field.str(fd, "dateUntil");
    const weekdays = fd.getAll("weekdays").map(Number);

    const dates: string[] = [];
    if (!until && weekdays.length)
      throw new UserError("Zaškrtla jsi dny v týdnu – vyplň ještě „Opakovat do“, do kdy se má lekce opakovat.");
    if (!until) {
      dates.push(from);
    } else {
      if (!isDateKey(until) || until < from) throw new UserError("Neplatné datum „do“.");
      if (!weekdays.length) throw new UserError("Vyber dny v týdnu pro opakování.");
      for (let d = from; d <= until; d = addDays(d, 1)) {
        if (weekdays.includes(weekdayOf(d))) dates.push(d);
        if (dates.length > 400) throw new UserError("Příliš mnoho termínů najednou.");
      }
    }
    if (!dates.length) throw new UserError("V daném rozsahu nevychází žádný termín.");
    const seriesId = dates.length > 1 ? crypto.randomUUID() : null;
    // a weekday can have its own start time (Mon 18:00, Wed 7:30…)
    const timeFor = (d: string) => {
      const own = field.str(fd, `time_${weekdayOf(d)}`);
      return until && /^\d{2}:\d{2}$/.test(own) ? own : time;
    };
    const rows = dates.map((d) => ({ ...values, seriesId, startsAt: pragueLocalToDate(`${d}T${timeFor(d)}`) }));
    checkOpensBefore(values.bookingOpensAt, rows.map((r) => r.startsAt));
    await (await getDb()).insert(classSessions).values(rows);
    return done(`Vytvořeno termínů: ${dates.length}.`);
  });
}

export async function updateSessionAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const { values } = await sessionValues(fd);
    const local = field.str(fd, "startsAt");
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new UserError("Neplatný čas.");
    const db = await getDb();
    const id = field.str(fd, "id");
    if (field.str(fd, "scope") !== "series") {
      checkOpensBefore(values.bookingOpensAt, [pragueLocalToDate(local)]);
      const before = await sessionsBefore(db, [id], values.isFree);
      await db.update(classSessions).set({ ...values, startsAt: pragueLocalToDate(local) }).where(eq(classSessions.id, id));
      return done(`Termín uložen.${await afterSessionEdit(db, before)}`);
    }
    // This and the following classes of the series: same settings, same new
    // start time, and moved by the same number of days if the date changed.
    const list = await seriesFrom(db, id);
    const [me] = list.filter((s) => s.id === id);
    if (!me) throw new UserError("Termín nenalezen.");
    const [newDay, newTime] = local.split("T");
    const shift = Math.round((Date.parse(newDay) - Date.parse(dateKey(me.startsAt))) / 86_400_000);
    const moved = list.map((s) => ({ id: s.id, startsAt: pragueLocalToDate(`${addDays(dateKey(s.startsAt), shift)}T${newTime}`) }));
    checkOpensBefore(values.bookingOpensAt, moved.map((s) => s.startsAt));
    const before = await sessionsBefore(db, moved.map((s) => s.id), values.isFree);
    await db.transaction(async (tx) => {
      for (const s of moved)
        await tx.update(classSessions).set({ ...values, startsAt: s.startsAt }).where(eq(classSessions.id, s.id));
    });
    return done(`Uloženo pro ${list.length} ${list.length === 1 ? "termín" : list.length < 5 ? "termíny" : "termínů"}.${await afterSessionEdit(db, before)}`);
  });
}

/**
 * Before editing classes: how they were. Switching a class with bookings between
 * free and paid would leave them charged wrong – that's refused.
 */
async function sessionsBefore(db: DB, ids: string[], isFree: boolean) {
  const list = ids.length ? await db.select().from(classSessions).where(inArray(classSessions.id, ids)) : [];
  for (const s of list)
    if (s.isFree !== isFree && (await occupancy(db, s.id)) > 0)
      throw new UserError(
        `Na lekci ${formatDay(s.startsAt)} už jsou přihlášení – mezi placenou a zdarma ji přepnout nejde. Odhlas je, nebo vytvoř novou lekci.`,
      );
  return list;
}

/** After editing classes: a new time is told to whoever's booked, a bigger class takes people from the waitlist. */
async function afterSessionEdit(db: DB, before: ClassSession[]) {
  const now = new Date();
  let told = 0;
  for (const old of before) {
    const [s] = await db.select().from(classSessions).where(eq(classSessions.id, old.id));
    if (!s || s.status === "cancelled" || s.startsAt <= now) continue;
    if (s.startsAt.getTime() !== old.startsAt.getTime()) told += await notifySessionMoved(db, s.id, old.startsAt).catch(() => 0);
    if (s.capacity > old.capacity) await notifyPromoted(db, await fillFromWaitlist(db, s.id, now)).catch(() => {});
  }
  return told ? ` Nový čas jsme poslali ${told} ${told === 1 ? "klientovi" : "klientům"}.` : "";
}

export async function cancelSessionAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const db = await getDb();
    const r = await cancelSession(db, field.str(fd, "id"));
    await notifySessionCancelled(db, r.session.id, r.affected);
    const n = cancelledRecipients(r.affected).length;
    return done(n ? `Lekce zrušena, dali jsme vědět ${n} ${n === 1 ? "klientovi" : "klientům"} a vrátili, co zaplatili.` : "Lekce zrušena.");
  });
}

/** Deletes classes; upcoming ones with clients are cancelled (refund + e-mail) first. */
async function removeSessions(ids: string[]) {
  const db = await getDb();
  const now = new Date();
  let notified = 0;
  for (const id of ids) {
    const [s] = await db.select().from(classSessions).where(eq(classSessions.id, id));
    if (!s) continue;
    if (s.status !== "cancelled" && s.startsAt > now && (await occupancy(db, id)) > 0) {
      const r = await cancelSession(db, id, now);
      await notifySessionCancelled(db, id, r.affected);
      notified += cancelledRecipients(r.affected).length;
    }
    await purgeSession(db, id);
  }
  return notified;
}

export async function deleteSessionAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  let back: string | null = null;
  const res = await attempt(async () => {
    const id = field.str(fd, "id");
    const db = await getDb();
    const [cur] = await db.select({ startsAt: classSessions.startsAt }).from(classSessions).where(eq(classSessions.id, id));
    const list = field.str(fd, "scope") === "series" ? await seriesFrom(db, id) : [{ id }];
    await removeSessions(list.map((s) => s.id));
    back = cur ? `/admin/rozvrh?tyden=${mondayOf(dateKey(cur.startsAt))}` : "/admin/rozvrh";
  });
  if (back) {
    revalidatePath("/", "layout");
    redirect(back);
  }
  return res;
}

export async function deleteSessionsRangeAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const from = field.str(fd, "from");
    const to = field.str(fd, "to");
    if (!isDateKey(from) || !isDateKey(to) || to < from) throw new UserError("Vyplň platné rozmezí dnů.");
    const typeId = field.str(fd, "classTypeId");
    const list = await (await getDb())
      .select({ id: classSessions.id })
      .from(classSessions)
      .where(
        and(
          gte(classSessions.startsAt, pragueLocalToDate(from)),
          lt(classSessions.startsAt, pragueLocalToDate(addDays(to, 1))),
          typeId ? eq(classSessions.classTypeId, typeId) : undefined,
        ),
      );
    if (!list.length) return done("V tomhle rozmezí nejsou žádné lekce.");
    const notified = await removeSessions(list.map((s) => s.id));
    return done(
      `Smazáno lekcí: ${list.length}.` + (notified ? ` ${notified} klientům se vrátil vstup a přišel e-mail.` : ""),
    );
  });
}

export async function deleteSessionsAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const ids = fd.getAll("ids").map(String).filter(Boolean);
    if (!ids.length) throw new UserError("Zaškrtni lekce, které chceš smazat.");
    const notified = await removeSessions(ids);
    return done(
      `Smazáno lekcí: ${ids.length}.` + (notified ? ` ${notified} klientům se vrátil vstup a přišel e-mail.` : ""),
    );
  });
}

async function findClient(ref: string) {
  const db = await getDb();
  const v = ref.trim();
  const [u] = /^[0-9a-f-]{36}$/i.test(v)
    ? await db.select().from(users).where(eq(users.id, v))
    : await db.select().from(users).where(eq(users.email, normalizeEmail(v)));
  if (!u) throw new UserError(v.includes("@") ? "Klient s tímto e-mailem neexistuje." : "Vyber klienta ze seznamu.");
  return u;
}

/** What the picked client can pay this session with (reception's "Přidat klienta"). */
export async function adminBookingOptionsAction(sessionId: string, clientId: string, withFriend: boolean) {
  await requireStaff();
  const db = await getDb();
  const [s] = await db.select().from(classSessions).where(eq(classSessions.id, sessionId));
  if (!s || !/^[0-9a-f-]{36}$/i.test(clientId)) return [];
  const opts = await bookingOptions(db, clientId, s, withFriend ? 2 : 1);
  return opts.filter((o) => o.method !== "drop_in");
}

export async function adminAddBookingAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  return attempt(async () => {
    const db = await getDb();
    const u = await findClient(field.str(fd, "client"));
    // "auto" | "admin" | "<method>:<entitlementId?>"
    const raw = field.str(fd, "pay") || field.str(fd, "mode") || "auto";
    const [method, entitlementId] = raw.split(":");
    const pay: AdminPay =
      raw === "admin" ? "admin" : raw === "auto" ? "auto" : { method: method as Method, entitlementId: entitlementId || undefined };
    const guestName = field.str(fd, "guestName");
    const b = await adminAddBooking(db, { sessionId: field.str(fd, "sessionId"), userId: u.id, pay, guestName });
    await notifyBooked(db, b, true);
    return done(guestName ? `${u.name} + ${guestName} přidáni.` : `${u.name} přidán/a.`);
  });
}

/** Staff keeps spots on a class for themselves; 0 releases them. */
export async function holdSeatsAction(_: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return attempt(async () => {
    const db = await getDb();
    const seats = field.int(fd, "seats") ?? 0;
    const r = await holdSeats(db, { sessionId: field.str(fd, "sessionId"), userId: staff.id, seats, note: field.str(fd, "note") });
    await notifyPromoted(db, r.promoted);
    return done(seats ? `Drženo ${seats} ${seats === 1 ? "místo" : seats < 5 ? "místa" : "míst"}.` : "Místa uvolněna.");
  });
}

/** Reminds a client of an unpaid drop-in / surcharge (by booking, or by its order from the payment lists). */
export async function remindPaymentAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  return attempt(async () => {
    const db = await getDb();
    const bookingId = field.str(fd, "bookingId") || (await bookingOfOrder(db, field.str(fd, "orderId")));
    if (!bookingId) throw new UserError("Rezervace k platbě nenalezena.");
    const r = await remindPayment(db, bookingId);
    return done(r.emailed ? "Připomínka odeslána – e-mailem i do mobilu (má-li zapnuté notifikace)." : "Připomínka odeslána do mobilu (e-mail klient nemá).");
  });
}

export async function adminCancelBookingAction(_: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return attempt(async () => {
    const db = await getDb();
    const r = await cancelBooking(db, {
      bookingId: field.str(fd, "bookingId"),
      actorId: staff.id,
      isAdmin: true,
      refund: field.bool(fd, "refund"),
      instructor: staff.role !== "admin",
    });
    await notifyPromoted(db, r.promoted);
    // the client learns the studio cancelled an upcoming booking (not places staff held, not the waitlist)
    const b = r.booking;
    if (!b.isHold && b.status !== "waitlist" && r.session.startsAt > new Date()) await notifyCancelled(db, b, r.refunded, true).catch(() => {});
    if (b.method === "membership" && b.status === "confirmed" && r.late && !r.refunded)
      await notifyStrike(db, b.userId, await afterMemberStrike(db, b.userId));
    if (!r.refunded) return done(b.method === "membership" && b.status === "confirmed" && r.late ? "Zrušeno bez vrácení – pozdní storno se počítá do upozornění/pauzy." : "Zrušeno bez vrácení.");
    return done(b.method === "drop_in" && b.status !== "pending_payment" ? "Zrušeno – zaplacená částka se vrátila jako kredit." : "Zrušeno s vrácením.");
  });
}

export async function attendanceAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  return attempt(async () => {
    const status = field.str(fd, "status") as "attended" | "no_show" | "confirmed";
    const db = await getDb();
    const b = await setAttendance(db, field.str(fd, "bookingId"), status);
    if (status === "no_show" && b.method === "membership") await notifyStrike(db, b.userId, await afterMemberStrike(db, b.userId));
    // "didn't come" taken back – the pause it caused goes too
    if (b.was === "no_show" && status !== "no_show" && b.method === "membership" && (await reconsiderPause(db, b.userId)))
      return done("Docházka uložena a pauza v přihlašování zrušena.");
    return done("Docházka uložena.");
  });
}

/* -------------------------------------------------------------- clients */

/** Ends a booking pause and forgives the strikes counted so far. */
export async function clearPauseAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    await clearPause(await getDb(), field.str(fd, "userId"));
    return done("Hotovo – klient se může přihlašovat, prohřešky se počítají znovu od nuly.");
  });
}

export async function adjustCreditsAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  return attempt(async () => {
    const delta = field.int(fd, "delta");
    if (!delta) throw new UserError("Zadej počet kreditů (např. 5 nebo -2).");
    const db = await getDb();
    const bal = await db.transaction((tx) =>
      changeCredits(tx, {
        userId: field.str(fd, "userId"),
        delta,
        reason: field.str(fd, "reason") === "bonus" ? "bonus" : "admin",
        note: field.optional(fd, "note"),
        createdBy: admin.id,
      }),
    );
    return done(`Nový zůstatek: ${bal}.`);
  });
}

export async function setSurchargePaidAction(_: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return attempt(async () => {
    const paid = field.bool(fd, "paid");
    await setSurchargePaid(await getDb(), { bookingId: field.str(fd, "bookingId"), paid, isAdmin: staff.role === "admin" });
    return done(paid ? "Doplatek zaplacen." : "Doplatek vrácen na nezaplacený.");
  });
}

export async function deductSolariumAction(_: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return attempt(async () => {
    const minutes = field.int(fd, "minutes") ?? 0;
    const left = await deductSolarium(await getDb(), { userId: field.str(fd, "userId"), minutes, actorId: staff.id });
    return done(`Odečteno ${minutes} min. Zbývá ${left} min.`);
  });
}

/** Optional "only for this class" on a grant: the class type and the name suffix it adds. */
async function grantClassType(fd: FormData) {
  const id = field.str(fd, "classTypeId");
  if (!id) return { classTypeId: null, suffix: "", lesson: undefined };
  const [ct] = await (await getDb()).select({ id: classTypes.id, name: classTypes.name }).from(classTypes).where(eq(classTypes.id, id));
  if (!ct) throw new UserError("Lekce nenalezena.");
  return { classTypeId: ct.id, suffix: ` – ${ct.name}`, lesson: ct.name };
}

/** The client must see which class a restricted entry is for, even under a custom name. */
const withLesson = (name: string, only: { lesson?: string; suffix: string }) =>
  only.lesson && !name.toLowerCase().includes(only.lesson.toLowerCase()) ? name + only.suffix : name;

export async function grantEntitlementAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const kind = field.str(fd, "kind") as "free" | "pass" | "membership" | "solarium" | "massage_pass";
    if (!["free", "pass", "membership", "solarium", "massage_pass"].includes(kind)) throw new UserError("Vyber typ.");
    if (kind === "solarium" && !field.int(fd, "entries")) throw new UserError("Vyplň počet minut.");
    const only = ["free", "pass", "membership"].includes(kind) ? await grantClassType(fd) : { classTypeId: null, suffix: "", lesson: undefined };
    await grantEntitlement(await getDb(), {
      userId: field.str(fd, "userId"),
      kind,
      classTypeId: only.classTypeId,
      name: withLesson(
        field.str(fd, "name") ||
          {
            free: "Vstup zdarma",
            pass: "Permanentka",
            membership: "Členství",
            solarium: "Solárium",
            massage_pass: "Permanentka na masáže",
          }[kind],
        only,
      ),
      entries: field.int(fd, "entries"),
      validityDays: field.int(fd, "validityDays") ?? 30,
      weeklyLimit: field.int(fd, "weeklyLimit"),
      sameDayOnly: field.bool(fd, "sameDayOnly"),
      beforeHour: field.int(fd, "beforeHour"),
      note: field.optional(fd, "note"),
    });
    return done("Přiděleno.");
  });
}

const endOfDay = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? pragueLocalToDate(`${v}T23:59`) : null);
const startOfDay = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? pragueLocalToDate(`${v}T00:00`) : null);

/** Client detail: change how long a pass/membership is valid and how many entries it has. */
export async function updateEntitlementAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const db = await getDb();
    const [e] = await db.select().from(entitlements).where(eq(entitlements.id, field.str(fd, "id")));
    if (!e) throw new UserError("Permanentka nenalezena.");
    const until = endOfDay(field.str(fd, "until"));
    if (!until) throw new UserError("Vyplň datum konce platnosti.");
    const fromRaw = field.str(fd, "from");
    const from = fromRaw ? startOfDay(fromRaw) : e.validFrom;
    if (!from) throw new UserError("Neplatné datum začátku platnosti.");
    if (until <= from) throw new UserError("Konec musí být po začátku platnosti.");
    let entriesTotal = e.entriesTotal;
    if (e.entriesTotal !== null) {
      const n = field.int(fd, "entries");
      if (n === null || n < e.entriesUsed) throw new UserError(`Vstupů musí být aspoň ${e.entriesUsed} (už vyčerpané).`);
      entriesTotal = n;
    }
    let monthlyFee = e.monthlyFee;
    let monthlyFeeUntil = e.monthlyFeeUntil;
    if (e.kind === "membership") {
      const fee = field.str(fd, "monthlyFee").replace(/\s/g, "");
      if (fee && !/^\d+$/.test(fee)) throw new UserError("Měsíční příspěvek zadej v celých korunách.");
      monthlyFee = fee ? Number(fee) * 100 : null;
      const feeUntil = field.str(fd, "monthlyFeeUntil");
      if (feeUntil && !isPeriod(feeUntil)) throw new UserError("Měsíc, do kdy platí příspěvek, zadej jako rok a měsíc.");
      monthlyFeeUntil = monthlyFee !== null && feeUntil ? feeUntil : null;
    }
    await db
      .update(entitlements)
      .set({ validFrom: from, validUntil: until, entriesTotal, monthlyFee, monthlyFeeUntil })
      .where(eq(entitlements.id, e.id));
    // a new monthly fee: unpaid requests for the coming months follow it
    let note = "";
    if (e.kind === "membership" && monthlyFee !== e.monthlyFee) {
      const base = (await getSettings(db)).membershipMonthlyFee * 100;
      const after = monthlyFee ?? base;
      const followed = await followMonthlyFee(db, e.userId, e.monthlyFee ?? base, after, undefined, monthlyFeeUntil);
      if (followed.length) note = ` Nezaplacené výzvy (${followed.map(periodLabel).join(", ")}) jsou teď na ${formatPrice(after)}.`;
    }
    return done(`Uloženo – platí ${formatDate(from)} – ${formatDate(until)}.${note}`);
  });
}

/** Client detail: when the credit balance expires (empty = never). */
export async function setCreditExpiryAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const raw = field.str(fd, "until");
    const until = raw ? endOfDay(raw) : null;
    if (raw && !until) throw new UserError("Neplatné datum.");
    await (await getDb())
      .update(users)
      .set({ creditExpiresAt: until, creditExpiryWarnedAt: null })
      .where(eq(users.id, field.str(fd, "userId")));
    return done(until ? `Kredit platí do ${formatDate(until)}.` : "Kredit teď platí bez omezení.");
  });
}

export async function cancelEntitlementAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const { upcoming } = await cancelEntitlement(await getDb(), field.str(fd, "id"));
    return done(upcoming ? `Zneplatněno. Pozor: na ni jsou ještě přihlášené budoucí lekce (${upcoming}) – zkontroluj je v rezervacích.` : "Zneplatněno.");
  });
}

export async function sellProductAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    await sellAtReception(await getDb(), {
      userId: field.str(fd, "userId"),
      productId: required(field.str(fd, "productId"), "Vyber produkt."),
    });
    return done("Prodáno a připsáno na účet.");
  });
}

export async function markOrderPaidAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const db = await getDb();
    const orderId = field.str(fd, "orderId");
    const [o] = await db.select({ provider: orders.provider, status: orders.status, kind: orders.kind }).from(orders).where(eq(orders.id, orderId));
    if (!o) throw new UserError("Objednávka neexistuje.");
    if (o.status !== "pending" && o.status !== "paid" && !paidLateOk(o)) throw new UserError("Tahle objednávka je zrušená – platbu za ni nejde potvrdit.");
    // a bank transfer stays labelled as such once it's confirmed
    const paid = await fulfillOrder(db, { orderId, provider: o.provider === "transfer" ? "transfer" : "manual" });
    await notifyPaid(db, paid).catch(() => {});
    if (paid.alreadyPaid) return done("Objednávka už byla zaplacená dřív.");
    const settled = paid.dropIn ?? paid.surcharge;
    if (settled?.outcome === "credited")
      return done(`Označeno jako zaplacené. Rezervace už neplatí – částka šla na účet jako kredit (${credits(settled.credit)}).`);
    if (paid.massageCancelled) return done("Označeno jako zaplacené. Masáž je ale zrušená – platbu je potřeba vrátit.");
    return done(paid.dropIn ? "Označeno jako zaplacené – místo na lekci je potvrzené." : "Označeno jako zaplacené.");
  });
}

/** Client detail: an unpaid order won't be paid – call it off. */
export async function cancelOrderAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    if (!(await cancelOrder(await getDb(), field.str(fd, "orderId")))) throw new UserError("Objednávka už nečeká na platbu.");
    return done("Objednávka zrušena.");
  });
}

export async function deleteOrderAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const res = await attempt(async () => {
    const db = await getDb();
    const freed = await deleteOrder(db, field.str(fd, "orderId"), admin.id);
    // a drop-in place let go goes to the waitlist
    for (const id of freed) await notifyPromoted(db, await fillFromWaitlist(db, id)).catch(() => {});
    return done(freed.length ? "Objednávka smazána a rezervace na lekci zrušena." : "Objednávka smazána, co přidělila, bylo odebráno.");
  });
  return res;
}

export async function resetOrdersAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const res = await attempt(async () => {
    const providers = ["reception", "manual", "test", "stripe"].filter((p) => field.bool(fd, p));
    const day = field.str(fd, "before");
    if (!isDateKey(day)) throw new UserError("Vyplň datum.");
    const n = await deleteOrders(await getDb(), {
      providers,
      before: pragueLocalToDate(addDays(day, 1)),
      actorId: admin.id,
    });
    return done(n ? `Smazáno objednávek: ${n}.` : "Nic k smazání.");
  });
  return res;
}

/** E-mails the client a link to set her password; the link then leads to her consents in the profile. */
async function sendAccountInvite(db: Awaited<ReturnType<typeof getDb>>, u: { id: string; name: string; email: string }) {
  const link = await createPasswordLink(u.id, 14 * 24, db);
  await sendEmail(u.email, "studioAccount", {
    osloveni: greetName(u.name),
    odkaz: `${link}&dalsi=${encodeURIComponent("/ucet/profil#osobni-udaje")}`,
    prihlaseni: u.email,
  });
}

/** Clients: the reception creates an account; the client gets an e-mail to set her password and consents. */
export async function createClientAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  let created = "";
  const res = await attempt(async () => {
    const db = await getDb();
    const u = await createClientByStudio(db, {
      name: field.str(fd, "name"),
      email: field.str(fd, "email"),
      phone: field.str(fd, "phone"),
      birthDate: field.str(fd, "birthDate"),
    });
    const invite = field.bool(fd, "invite");
    if (invite) await sendAccountInvite(db, u);
    created = `/admin/klienti/${u.id}?novy=${invite ? "pozvanka" : "ucet"}`;
  });
  if (created) {
    revalidatePath("/", "layout");
    redirect(created);
  }
  return res;
}

/** Client detail: the password isn't set yet – send the invitation (again). */
export async function resendAccountInviteAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const db = await getDb();
    const [u] = await db.select().from(users).where(eq(users.id, field.str(fd, "userId")));
    if (!u) throw new UserError("Klient nenalezen.");
    if (!u.passwordHash.startsWith("!")) throw new UserError("Heslo už má nastavené – případně ať použije „Zapomenuté heslo“.");
    await sendAccountInvite(db, u);
    return `Pozvánka odeslána na ${u.email}.`;
  });
}

export async function deleteClientAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const res = await attempt(async () => {
    await deleteClient(await getDb(), field.str(fd, "userId"), admin.id);
  });
  if (res?.ok) {
    revalidatePath("/", "layout");
    redirect("/admin/klienti");
  }
  return res;
}

/** Clients list: grant a membership/pass to all ticked clients at once. */
export async function bulkGrantAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const ids = [...new Set(fd.getAll("ids").map(String).filter(Boolean))];
    if (!ids.length) throw new UserError("Zaškrtni v seznamu klienty, kterým chceš přidělit.");
    const kind = field.str(fd, "kind") as "free" | "pass" | "membership";
    if (!["free", "pass", "membership"].includes(kind)) throw new UserError("Vyber typ.");
    const until = field.str(fd, "until");
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(until);
    if (!m) throw new UserError("Vyplň, do kdy platí.");
    const validUntil = pragueLocalToDate(`${until}T23:59`);
    if (validUntil <= new Date()) throw new UserError("Datum konce musí být v budoucnu.");
    const entries = kind === "membership" ? null : field.int(fd, "entries");
    if (kind !== "membership" && !entries) throw new UserError("Vyplň počet vstupů.");
    const only = await grantClassType(fd);
    const name = withLesson(field.str(fd, "name") || { free: "Vstup zdarma", pass: "Permanentka", membership: "Členství" }[kind], only);
    const db = await getDb();
    const clients = await db.select({ id: users.id }).from(users).where(and(inArray(users.id, ids), eq(users.role, "client")));
    for (const c of clients)
      await grantEntitlement(db, { userId: c.id, kind, name, entries, validityDays: 1, validUntil, classTypeId: only.classTypeId, note: field.optional(fd, "note") });
    return done(`${name} přiděleno ${clients.length} klientům (platí do ${formatDate(validUntil)}).`);
  });
}

export async function deleteClientsAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const ids = fd.getAll("ids").map(String).filter(Boolean);
    if (!ids.length) throw new UserError("Zaškrtni klienty, které chceš smazat.");
    const n = await deleteClients(await getDb(), { ids });
    return done(`Smazáno klientů: ${n}.`);
  });
}

/** Clients list form: the pressed button decides – grant or delete the ticked clients. */
export async function clientsBulkAction(prev: FormState, fd: FormData): Promise<FormState> {
  return field.str(fd, "do") === "grant" ? bulkGrantAction(prev, fd) : deleteClientsAction(prev, fd);
}

export async function deleteAllClientsAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    if (field.str(fd, "confirm").trim().toUpperCase() !== "SMAZAT")
      throw new UserError("Pro potvrzení napiš do políčka SMAZAT.");
    const n = await deleteClients(await getDb(), {
      all: true,
      importedOnly: field.str(fd, "scope") === "imported",
    });
    return done(`Smazáno klientů: ${n}. Účty adminů a lektorů zůstaly.`);
  });
}

export async function updateClientAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  return attempt(async () => {
    const id = field.str(fd, "userId");
    const role = field.str(fd, "role") as "client" | "instructor" | "admin";
    if (!["client", "instructor", "admin"].includes(role)) throw new UserError("Neplatná role.");
    if (id === admin.id && role !== "admin") throw new UserError("Sám sobě roli admina neodebereš.");
    const email = normalizeEmail(required(field.str(fd, "email"), "Vyplň e-mail."));
    const db = await getDb();
    const [clash] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (clash && clash.id !== id) throw new UserError("Tento e-mail už používá jiný účet.");
    await db
      .update(users)
      .set({
        name: required(field.str(fd, "name"), "Vyplň jméno."),
        email,
        phone: normalizePhone(field.str(fd, "phone")) ?? field.optional(fd, "phone"),
        role,
        adminNote: field.optional(fd, "adminNote"),
        marketingConsent: field.bool(fd, "marketingConsent"),
        smsConsent: field.bool(fd, "smsConsent"),
        whatsappConsent: field.bool(fd, "whatsappConsent"),
        remindersOptIn: field.bool(fd, "remindersOptIn"),
        nickname: field.str(fd, "nickname").slice(0, 30) || null,
        birthDate: cleanBirthDate(field.str(fd, "birthDate")),
        nameDay: cleanNameDay(field.int(fd, "nameDayDay"), field.int(fd, "nameDayMonth")),
        // ISIC / potvrzení o studiu seen at the reception; empty = not a student
        studentUntil: isDateKey(field.str(fd, "studentUntil")) ? field.str(fd, "studentUntil") : null,
      })
      .where(eq(users.id, id));
    // verified (or turned down) – the uploaded ID photo isn't needed any more
    if (isDateKey(field.str(fd, "studentUntil")) || field.bool(fd, "dropStudentProof")) await deleteStudentProof(db, id);
    return done("Klient uložen.");
  });
}
