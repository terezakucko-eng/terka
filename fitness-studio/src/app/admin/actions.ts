"use server";

import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import {
  announcements,
  bookings,
  classSessions,
  classTypes,
  entitlements,
  instructors,
  orders,
  products,
  users,
} from "@/db/schema";
import {
  adminAddBooking,
  cancelBooking,
  cancelSession,
  occupancy,
  setAttendance,
} from "@/domain/booking";
import { deleteClassType, deleteProduct } from "@/domain/catalog";
import { deleteClient, deleteClients, deleteOrder, deleteOrders, purgeSession, seriesFrom } from "@/domain/cleanup";
import { fulfillOrder, sellAtReception } from "@/domain/orders";
import { deductSolarium } from "@/domain/solarium";
import { grantEntitlement, normalizeEmail } from "@/domain/users";
import { changeCredits } from "@/domain/wallet";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { addDays, dateKey, formatDate, pragueLocalToDate, weekdayOf, isDateKey } from "@/lib/dates";
import { UserError } from "@/lib/errors";
import { attempt, field, type FormState } from "@/lib/form";
import { notifyBooked, notifyPromoted, notifySessionCancelled, notifyStrike } from "@/lib/notify";
import { afterMemberStrike, clearPause } from "@/domain/strikes";
import { storeImage, uploadedFile } from "@/lib/media";
import { normalizePhone } from "@/lib/phone";
import { defaultSettings, saveSettings, type Settings } from "@/lib/settings";
import { cleanBirthDate, cleanNameDay } from "@/lib/profile";
import { videoEmbedUrl } from "@/lib/video";

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
    const values = {
      name,
      slug: field.str(fd, "slug") || slugify(name),
      description: field.str(fd, "description"),
      durationMin: field.int(fd, "durationMin") ?? 60,
      capacity: field.int(fd, "capacity") ?? 12,
      creditCost: field.int(fd, "creditCost") ?? 1,
      dropInPrice: field.money(fd, "dropInPrice"),
      color: field.str(fd, "color") || "#D2A772",
      level: field.str(fd, "level") || "Pro všechny",
      memberSurcharge: field.money(fd, "memberSurcharge") || null,
      memberSurchargeFrom: isDateKey(field.str(fd, "memberSurchargeFrom")) ? field.str(fd, "memberSurchargeFrom") : null,
      firstVisitPrice: field.money(fd, "firstVisitPrice"),
      duoPrice: field.money(fd, "duoPrice"),
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
      recurring: kind === "membership" && field.bool(fd, "recurring"),
      highlight: field.bool(fd, "highlight"),
      linkOnly: field.bool(fd, "linkOnly"),
      membersOnly: field.bool(fd, "membersOnly"),
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
      body: required(field.str(fd, "body"), "Vyplň text."),
      isPinned: field.bool(fd, "isPinned"),
      isPublished: field.bool(fd, "isPublished"),
    };
    const id = field.str(fd, "id");
    if (id) await db.update(announcements).set(values).where(eq(announcements.id, id));
    else await db.insert(announcements).values(values);
    return done("Aktualita uložena.");
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
      note: field.optional(fd, "note"),
    },
  };
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
    await (await getDb()).insert(classSessions).values(
      dates.map((d) => ({ ...values, seriesId, startsAt: pragueLocalToDate(`${d}T${timeFor(d)}`) })),
    );
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
      await db.update(classSessions).set({ ...values, startsAt: pragueLocalToDate(local) }).where(eq(classSessions.id, id));
      return done("Termín uložen.");
    }
    // This and the following classes of the series: same settings, same new
    // start time, and moved by the same number of days if the date changed.
    const list = await seriesFrom(db, id);
    const [me] = list.filter((s) => s.id === id);
    if (!me) throw new UserError("Termín nenalezen.");
    const [newDay, newTime] = local.split("T");
    const shift = Math.round((Date.parse(newDay) - Date.parse(dateKey(me.startsAt))) / 86_400_000);
    await db.transaction(async (tx) => {
      for (const s of list)
        await tx
          .update(classSessions)
          .set({ ...values, startsAt: pragueLocalToDate(`${addDays(dateKey(s.startsAt), shift)}T${newTime}`) })
          .where(eq(classSessions.id, s.id));
    });
    return done(`Uloženo pro ${list.length} ${list.length === 1 ? "termín" : list.length < 5 ? "termíny" : "termínů"}.`);
  });
}

export async function cancelSessionAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const db = await getDb();
    const r = await cancelSession(db, field.str(fd, "id"));
    const notify = r.affected.filter((b) => b.status !== "waitlist").map((b) => b.userId);
    await notifySessionCancelled(db, r.session.id, notify);
    return done(`Lekce zrušena, vráceno ${notify.length} klientům.`);
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
      const notify = r.affected.filter((b) => b.status !== "waitlist").map((b) => b.userId);
      await notifySessionCancelled(db, id, notify);
      notified += notify.length;
    }
    await purgeSession(db, id);
  }
  return notified;
}

export async function deleteSessionAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  let ok = false;
  const res = await attempt(async () => {
    const id = field.str(fd, "id");
    const list = field.str(fd, "scope") === "series" ? await seriesFrom(await getDb(), id) : [{ id }];
    await removeSessions(list.map((s) => s.id));
    ok = true;
  });
  if (ok) {
    revalidatePath("/", "layout");
    redirect("/admin/rozvrh");
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
  if (!u) throw new UserError("Klient s tímto e-mailem neexistuje.");
  return u;
}

export async function adminAddBookingAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  return attempt(async () => {
    const db = await getDb();
    const u = await findClient(field.str(fd, "client"));
    const mode = field.str(fd, "mode") === "admin" ? "admin" : "auto";
    const b = await adminAddBooking(db, { sessionId: field.str(fd, "sessionId"), userId: u.id, mode });
    await notifyBooked(db, b);
    return done(`${u.name} přidán/a.`);
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
    });
    await notifyPromoted(db, r.promoted);
    return done(r.refunded ? "Zrušeno s vrácením." : "Zrušeno bez vrácení.");
  });
}

export async function attendanceAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  return attempt(async () => {
    const status = field.str(fd, "status") as "attended" | "no_show" | "confirmed";
    const db = await getDb();
    const b = await setAttendance(db, field.str(fd, "bookingId"), status);
    if (status === "no_show" && b.method === "membership") await notifyStrike(db, b.userId, await afterMemberStrike(db, b.userId));
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
  await requireStaff();
  return attempt(async () => {
    const paid = field.bool(fd, "paid");
    await (await getDb())
      .update(bookings)
      .set({ surchargePaidAt: paid ? new Date() : null })
      .where(eq(bookings.id, field.str(fd, "bookingId")));
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

export async function grantEntitlementAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const kind = field.str(fd, "kind") as "free" | "pass" | "membership" | "solarium" | "massage_pass";
    if (!["free", "pass", "membership", "solarium", "massage_pass"].includes(kind)) throw new UserError("Vyber typ.");
    if (kind === "solarium" && !field.int(fd, "entries")) throw new UserError("Vyplň počet minut.");
    await grantEntitlement(await getDb(), {
      userId: field.str(fd, "userId"),
      kind,
      name:
        field.str(fd, "name") ||
        {
          free: "Vstup zdarma",
          pass: "Permanentka",
          membership: "Členství",
          solarium: "Solárium",
          massage_pass: "Permanentka na masáže",
        }[kind],
      entries: field.int(fd, "entries"),
      validityDays: field.int(fd, "validityDays") ?? 30,
      weeklyLimit: field.int(fd, "weeklyLimit"),
      note: field.optional(fd, "note"),
    });
    return done("Přiděleno.");
  });
}

const endOfDay = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? pragueLocalToDate(`${v}T23:59`) : null);

/** Client detail: change how long a pass/membership is valid and how many entries it has. */
export async function updateEntitlementAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const db = await getDb();
    const [e] = await db.select().from(entitlements).where(eq(entitlements.id, field.str(fd, "id")));
    if (!e) throw new UserError("Permanentka nenalezena.");
    const until = endOfDay(field.str(fd, "until"));
    if (!until) throw new UserError("Vyplň datum konce platnosti.");
    if (until <= e.validFrom) throw new UserError("Konec musí být po začátku platnosti.");
    let entriesTotal = e.entriesTotal;
    if (e.entriesTotal !== null) {
      const n = field.int(fd, "entries");
      if (n === null || n < e.entriesUsed) throw new UserError(`Vstupů musí být aspoň ${e.entriesUsed} (už vyčerpané).`);
      entriesTotal = n;
    }
    let monthlyFee = e.monthlyFee;
    if (e.kind === "membership") {
      const fee = field.str(fd, "monthlyFee").replace(/\s/g, "");
      if (fee && !/^\d+$/.test(fee)) throw new UserError("Měsíční příspěvek zadej v celých korunách.");
      monthlyFee = fee ? Number(fee) * 100 : null;
    }
    await db
      .update(entitlements)
      .set({ validUntil: until, entriesTotal, monthlyFee })
      .where(eq(entitlements.id, e.id));
    return done(`Uloženo – platí do ${formatDate(until)}.`);
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
    await (await getDb())
      .update(entitlements)
      .set({ status: "cancelled" })
      .where(eq(entitlements.id, field.str(fd, "id")));
    return done("Zneplatněno.");
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
    const [o] = await db.select({ provider: orders.provider }).from(orders).where(eq(orders.id, orderId));
    // a bank transfer stays labelled as such once it's confirmed
    await fulfillOrder(db, { orderId, provider: o?.provider === "transfer" ? "transfer" : "manual" });
    return done("Označeno jako zaplacené.");
  });
}

export async function deleteOrderAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const res = await attempt(async () => {
    await deleteOrder(await getDb(), field.str(fd, "orderId"), admin.id);
    return done("Objednávka smazána, co přidělila, bylo odebráno.");
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
    const name = field.str(fd, "name") || { free: "Vstup zdarma", pass: "Permanentka", membership: "Členství" }[kind];
    const db = await getDb();
    const clients = await db.select({ id: users.id }).from(users).where(and(inArray(users.id, ids), eq(users.role, "client")));
    for (const c of clients)
      await grantEntitlement(db, { userId: c.id, kind, name, entries, validityDays: 1, validUntil, note: field.optional(fd, "note") });
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
      })
      .where(eq(users.id, id));
    return done("Klient uložen.");
  });
}
