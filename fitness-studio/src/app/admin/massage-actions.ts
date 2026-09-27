"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getContent } from "@/content";
import { getDb } from "@/db";
import { massageBookings, massageServices, users } from "@/db/schema";
import {
  addAvailability,
  adminBookMassage,
  cancelMassage,
  deleteMassageService,
  removeAvailability,
} from "@/domain/massages";
import { normalizeEmail } from "@/domain/users";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { isDateKey, pragueLocalToDate } from "@/lib/dates";
import { UserError } from "@/lib/errors";
import { attempt, field, type FormState } from "@/lib/form";
import { storeImage, uploadedFile } from "@/lib/media";
import { notifyMassageBooked, notifyMassageCancelled } from "@/lib/notify-massage";

const done = (msg: string) => {
  revalidatePath("/", "layout");
  return msg;
};

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function saveMassageServiceAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const db = await getDb();
    const name = field.str(fd, "name");
    if (!name) throw new UserError("Vyplň název.");
    const price = field.money(fd, "price");
    if (price === null) throw new UserError("Vyplň cenu.");
    const file = uploadedFile(fd, "image");
    const values = {
      name,
      slug: field.str(fd, "slug") || slugify(name),
      description: field.str(fd, "description"),
      durationMin: Math.max(field.int(fd, "durationMin") ?? 60, 10),
      price,
      memberPrice: field.money(fd, "memberPrice"),
      sortOrder: field.int(fd, "sortOrder") ?? 0,
      isActive: field.bool(fd, "isActive"),
      ...(file ? { imageUrl: await storeImage(db, file, 1600) } : field.bool(fd, "removeImage") ? { imageUrl: null } : {}),
    };
    const id = field.str(fd, "id");
    if (id) await db.update(massageServices).set(values).where(eq(massageServices.id, id));
    else await db.insert(massageServices).values(values);
    return done(id ? "Masáž uložena." : "Masáž přidána do nabídky.");
  });
}

export async function deleteMassageServiceAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const r = await deleteMassageService(await getDb(), field.str(fd, "id"));
    return done(r === "deleted" ? "Masáž smazána." : "Masáž smazána, proběhlé rezervace zůstávají v historii.");
  });
}

export async function addAvailabilityAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const date = field.str(fd, "date");
    const from = field.str(fd, "from");
    const to = field.str(fd, "to");
    if (!isDateKey(date)) throw new UserError("Vyber den.");
    if (!TIME.test(from) || !TIME.test(to)) throw new UserError("Vyplň čas od–do.");
    const n = await addAvailability(await getDb(), { date, from, to, weeks: field.int(fd, "weeks") ?? 1 });
    return done(n ? `Přidáno ${n}× volné okno.` : "V těchto časech už máš okna vypsaná.");
  });
}

export async function removeAvailabilityAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    await removeAvailability(await getDb(), field.str(fd, "id"));
    return done("Okno odebráno.");
  });
}

export async function adminBookMassageAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  return attempt(async () => {
    const db = await getDb();
    const at = field.str(fd, "startsAt");
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(at)) throw new UserError("Vyplň datum a čas.");
    const name = field.str(fd, "name");
    const email = field.str(fd, "email") ? normalizeEmail(field.str(fd, "email")) : "";
    const [known] = email ? await db.select().from(users).where(eq(users.email, email)) : [];
    if (!known && !name) throw new UserError("Vyplň jméno klienta.");
    const payment = field.str(fd, "payment") === "transfer" ? "transfer" : "on_site";
    const common = {
      serviceId: field.str(fd, "serviceId"),
      startsAt: pragueLocalToDate(at),
      payment,
      note: field.optional(fd, "note"),
      memberRate: field.bool(fd, "memberRate") || undefined,
    } as const;
    const b = await adminBookMassage(
      db,
      known
        ? { ...common, userId: known.id }
        : { ...common, guest: { name, phone: field.optional(fd, "phone"), email: email || null } },
    );
    if (field.bool(fd, "notify")) {
      const c = await getContent();
      await notifyMassageBooked(db, b, c("massages.bankAccount").trim(), "");
    }
    return done("Masáž zapsána.");
  });
}

export async function setMassagePaidAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  return attempt(async () => {
    const paid = field.bool(fd, "paid");
    await (await getDb())
      .update(massageBookings)
      .set({ paidAt: paid ? new Date() : null })
      .where(eq(massageBookings.id, field.str(fd, "id")));
    return done(paid ? "Označeno jako zaplacené." : "Platba zrušena.");
  });
}

export async function adminCancelMassageAction(_: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return attempt(async () => {
    const db = await getDb();
    const b = await cancelMassage(db, { bookingId: field.str(fd, "id"), actorId: staff.id, staff: true });
    if (field.bool(fd, "notify")) await notifyMassageCancelled(db, b, "", true);
    return done(b.paidAt ? "Zrušeno. Nezapomeň vrátit platbu převodem." : "Masáž zrušena.");
  });
}
