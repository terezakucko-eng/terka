"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import {
  announcements,
  classSessions,
  classTypes,
  entitlements,
  instructors,
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
import { fulfillOrder, sellAtReception } from "@/domain/orders";
import { grantEntitlement, normalizeEmail } from "@/domain/users";
import { changeCredits } from "@/domain/wallet";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { addDays, pragueLocalToDate, weekdayOf, isDateKey } from "@/lib/dates";
import { UserError } from "@/lib/errors";
import { attempt, field, type FormState } from "@/lib/form";
import { notifyBooked, notifyPromoted, notifySessionCancelled } from "@/lib/notify";
import { storeImage, uploadedFile } from "@/lib/media";
import { normalizePhone } from "@/lib/phone";
import { defaultSettings, saveSettings, type Settings } from "@/lib/settings";

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

export async function saveProductAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const db = await getDb();
    const kind = field.str(fd, "kind") as "credit_pack" | "pass" | "membership";
    if (!["credit_pack", "pass", "membership"].includes(kind)) throw new UserError("Vyber typ.");
    const values = {
      kind,
      name: required(field.str(fd, "name"), "Vyplň název."),
      description: field.str(fd, "description"),
      price: required(field.money(fd, "price"), "Vyplň cenu."),
      credits: kind === "credit_pack" ? required(field.int(fd, "credits"), "Vyplň počet kreditů.") : null,
      entries: kind === "credit_pack" ? null : field.int(fd, "entries"),
      validityDays: kind === "credit_pack" ? null : (field.int(fd, "validityDays") ?? 30),
      weeklyLimit: kind === "membership" ? field.int(fd, "weeklyLimit") : null,
      recurring: kind === "membership" && field.bool(fd, "recurring"),
      highlight: field.bool(fd, "highlight"),
      isActive: field.bool(fd, "isActive"),
      sortOrder: field.int(fd, "sortOrder") ?? 0,
    };
    if (kind === "pass" && !values.entries) throw new UserError("Permanentka potřebuje počet vstupů.");
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
    await (await getDb()).insert(classSessions).values(
      dates.map((d) => ({ ...values, seriesId, startsAt: pragueLocalToDate(`${d}T${time}`) })),
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
    await (await getDb())
      .update(classSessions)
      .set({ ...values, startsAt: pragueLocalToDate(local) })
      .where(eq(classSessions.id, field.str(fd, "id")));
    return done("Termín uložen.");
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

export async function deleteSessionAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  let ok = false;
  const res = await attempt(async () => {
    const db = await getDb();
    const id = field.str(fd, "id");
    if ((await occupancy(db, id)) > 0)
      throw new UserError("Na lekci jsou rezervace – použij „Zrušit lekci“.");
    await db.delete(classSessions).where(eq(classSessions.id, id));
    ok = true;
  });
  if (ok) {
    revalidatePath("/", "layout");
    redirect("/admin/rozvrh");
  }
  return res;
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
    await setAttendance(await getDb(), field.str(fd, "bookingId"), status);
    return done("Docházka uložena.");
  });
}

/* -------------------------------------------------------------- clients */

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

export async function grantEntitlementAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const kind = field.str(fd, "kind") as "free" | "pass" | "membership";
    if (!["free", "pass", "membership"].includes(kind)) throw new UserError("Vyber typ.");
    await grantEntitlement(await getDb(), {
      userId: field.str(fd, "userId"),
      kind,
      name:
        field.str(fd, "name") ||
        { free: "Vstup zdarma", pass: "Permanentka", membership: "Členství" }[kind],
      entries: field.int(fd, "entries"),
      validityDays: field.int(fd, "validityDays") ?? 30,
      weeklyLimit: field.int(fd, "weeklyLimit"),
      note: field.optional(fd, "note"),
    });
    return done("Přiděleno.");
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
    await fulfillOrder(await getDb(), { orderId: field.str(fd, "orderId"), provider: "manual" });
    return done("Označeno jako zaplacené.");
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
      })
      .where(eq(users.id, id));
    return done("Klient uložen.");
  });
}
