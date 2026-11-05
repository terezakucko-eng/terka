import { randomInt } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { DB, Executor } from "@/db";
import { orders, products, users, vouchers, type Voucher } from "@/db/schema";
import { UserError } from "@/lib/errors";
import { credits, formatPrice } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { changeCredits, extendCreditValidity } from "./wallet";
import { grantProduct } from "./grant";
import { onSaleNow } from "@/lib/queries";

const DAY = 86_400_000;

/**
 * Dárkové poukazy: bought on the web (card / transfer) or issued at the
 * reception. A voucher is for a price-list item (the recipient gets exactly
 * that) or for an amount (credit at a set rate). It's redeemed with its code
 * in Můj účet; the code works once, until the voucher expires.
 */

/** What can be given as a gift – not memberships (they come with a commitment). */
export const GIFT_KINDS = ["credit_pack", "pass", "massage_pass", "solarium"] as const;
/** Suggested amounts (Kč); any other amount in between works too. */
export const VOUCHER_AMOUNTS = [500, 1000, 1500, 2000];
export const MIN_VOUCHER_KC = 200;
export const MAX_VOUCHER_KC = 20000;
const MAX_TEXT = 200;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** "7KQ4M2PX" → "7KQ4-M2PX" */
export const formatVoucherCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;
/** What someone typed ("7kq4-m2px ") → "7KQ4M2PX" */
export const normalizeVoucherCode = (input: string) => input.toUpperCase().replace(/[^A-Z0-9]/g, "");

async function newCode(db: Executor) {
  for (;;) {
    const code = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    const [taken] = await db.select({ id: vouchers.id }).from(vouchers).where(eq(vouchers.code, code));
    if (!taken) return code;
  }
}

export function giftableProducts(db: Executor) {
  return db
    .select()
    .from(products)
    .where(
      and(
        eq(products.isActive, true),
        isNull(products.archivedAt),
        eq(products.linkOnly, false),
        eq(products.membersOnly, false),
        eq(products.studentsOnly, false),
        inArray(products.kind, [...GIFT_KINDS]),
        // not one with a limited number of places (Permanentka Reformer) – a voucher would skip the limit
        isNull(products.sharesPlacesWith),
        isNull(products.maxActive),
        gt(products.price, 0),
        onSaleNow(),
      ),
    )
    .orderBy(asc(products.sortOrder), asc(products.price));
}

/** Credits an amount voucher gives (per the rate in Nastavení). */
export const voucherCredits = (amountHalere: number, per100Kc: number) => Math.round((amountHalere / 10000) * per100Kc);

export type VoucherChoice = { productId?: string | null; amountKc?: number | null; recipientName?: string; message?: string };

/**
 * A new voucher with its order (pending until paid). The buyer is the
 * client buying online, or whoever the reception sells it to.
 */
export async function createVoucherOrder(db: Executor, buyerId: string, choice: VoucherChoice, now = new Date()) {
  const recipientName = choice.recipientName?.trim().slice(0, 60) || null;
  const message = choice.message?.trim() || null;
  if (message && message.length > MAX_TEXT) throw new UserError(`Věnování může mít nejvýš ${MAX_TEXT} znaků.`);
  const cfg = await getSettings(db);
  let item: Pick<Voucher, "kind" | "productId" | "title" | "amount" | "credits">;
  if (choice.productId) {
    const [p] = await giftableProducts(db).then((list) => list.filter((x) => x.id === choice.productId));
    if (!p) throw new UserError("Tahle položka se jako dárek koupit nedá.");
    item = { kind: "product", productId: p.id, title: p.name, amount: p.price, credits: null };
  } else {
    const kc = Math.round(choice.amountKc ?? 0);
    if (!kc || kc < MIN_VOUCHER_KC || kc > MAX_VOUCHER_KC)
      throw new UserError(`Částka poukazu musí být mezi ${MIN_VOUCHER_KC} a ${MAX_VOUCHER_KC.toLocaleString("cs-CZ")} Kč.`);
    const amount = kc * 100;
    item = { kind: "amount", productId: null, title: `Poukaz na ${formatPrice(amount)}`, amount, credits: voucherCredits(amount, cfg.voucherCreditsPer100Kc) };
  }
  const [order] = await db
    .insert(orders)
    .values({
      userId: buyerId,
      kind: "voucher",
      description: `Dárkový poukaz – ${item.title}`,
      amount: item.amount,
      provider: "pending",
      expiresAt: new Date(now.getTime() + DAY),
    })
    .returning();
  const [voucher] = await db
    .insert(vouchers)
    .values({ ...item, code: await newCode(db), recipientName, message, buyerId, orderId: order.id, createdAt: now })
    .returning();
  return { order, voucher };
}

/** The voucher's order was paid – from now on it can be redeemed. */
export async function activateVoucher(tx: Executor, orderId: string, now = new Date()) {
  const cfg = await getSettings(tx);
  await tx
    .update(vouchers)
    .set({ paidAt: now, validUntil: new Date(now.getTime() + Math.max(1, cfg.voucherValidityDays) * DAY) })
    .where(and(eq(vouchers.orderId, orderId), isNull(vouchers.paidAt)));
}

export type VoucherStatus = "pending" | "active" | "redeemed" | "expired" | "cancelled";

export function voucherStatus(v: Pick<Voucher, "paidAt" | "validUntil" | "redeemedAt" | "cancelledAt">, now = new Date()): VoucherStatus {
  if (v.cancelledAt) return "cancelled";
  if (v.redeemedAt) return "redeemed";
  if (!v.paidAt) return "pending";
  if (v.validUntil && v.validUntil <= now) return "expired";
  return "active";
}

export const VOUCHER_STATUS: Record<VoucherStatus, string> = {
  pending: "Čeká na zaplacení",
  active: "Platný",
  redeemed: "Uplatněný",
  expired: "Propadlý",
  cancelled: "Zrušený",
};

export async function voucherByCode(db: Executor, input: string) {
  const code = normalizeVoucherCode(input);
  if (code.length !== 8) return null;
  const [v] = await db.select().from(vouchers).where(eq(vouchers.code, code));
  return v ?? null;
}

/** What the recipient gets – for the voucher, the check page and the confirmation. */
export function voucherContents(v: Pick<Voucher, "kind" | "title" | "credits">) {
  return v.kind === "amount" ? `${v.title} – připíše se ${credits(v.credits ?? 0)}` : v.title;
}

/** Redeems a voucher for the signed-in client. */
export async function redeemVoucher(db: DB, input: string, userId: string, now = new Date()) {
  const code = normalizeVoucherCode(input);
  if (code.length !== 8) throw new UserError("Kód poukazu má 8 znaků, např. 7KQ4-M2PX.");
  return db.transaction(async (tx) => {
    const [v] = await tx.select().from(vouchers).where(eq(vouchers.code, code)).for("update");
    if (!v) throw new UserError("Poukaz s tímhle kódem neznáme. Zkontroluj prosím, že je opsaný správně.");
    const status = voucherStatus(v, now);
    if (status === "redeemed") throw new UserError("Tenhle poukaz už byl uplatněný.");
    if (status === "cancelled") throw new UserError("Tenhle poukaz byl zrušený. Ozvi se nám prosím.");
    if (status === "pending") throw new UserError("Poukaz ještě není zaplacený – platnost začne po zaplacení.");
    if (status === "expired") throw new UserError("Platnost poukazu už vypršela. Ozvi se nám, rádi to vyřešíme.");
    const note = `Dárkový poukaz ${formatVoucherCode(v.code)}`;
    if (v.kind === "product") {
      const [p] = await tx.select().from(products).where(eq(products.id, v.productId!));
      if (!p) throw new UserError("Položka z poukazu už neexistuje. Ozvi se nám prosím.");
      await grantProduct(tx, { userId, orderId: null, note }, p, now);
    } else {
      const cfg = await getSettings(tx);
      await changeCredits(tx, { userId, delta: v.credits ?? 0, reason: "purchase", note });
      await extendCreditValidity(tx, userId, Math.max(1, cfg.voucherValidityDays), now);
    }
    const [done] = await tx.update(vouchers).set({ redeemedAt: now, redeemedBy: userId }).where(eq(vouchers.id, v.id)).returning();
    return done;
  });
}

/** Vouchers the client bought (newest first). */
export const boughtVouchers = (db: Executor, buyerId: string) =>
  db
    .select({ v: vouchers })
    .from(vouchers)
    .leftJoin(orders, eq(vouchers.orderId, orders.id))
    .where(
      and(
        eq(vouchers.buyerId, buyerId),
        isNull(vouchers.cancelledAt),
        // an unpaid one only while it can still be paid (not an abandoned card checkout)
        or(isNotNull(vouchers.paidAt), eq(orders.status, "pending")),
      ),
    )
    .orderBy(desc(vouchers.createdAt))
    .then((rows) => rows.map((r) => r.v));

/** Admin list with buyer and recipient names. */
export async function adminVouchers(db: Executor, limit = 300) {
  const buyer = alias(users, "buyer");
  const redeemer = alias(users, "redeemer");
  return db
    .select({ v: vouchers, buyer: buyer.name, buyerId: buyer.id, redeemer: redeemer.name, redeemerId: redeemer.id, orderStatus: orders.status })
    .from(vouchers)
    .leftJoin(buyer, eq(vouchers.buyerId, buyer.id))
    .leftJoin(redeemer, eq(vouchers.redeemedBy, redeemer.id))
    .leftJoin(orders, eq(vouchers.orderId, orders.id))
    .orderBy(desc(vouchers.createdAt))
    .limit(limit);
}

export async function cancelVoucher(db: Executor, id: string, now = new Date()) {
  const [v] = await db.select().from(vouchers).where(eq(vouchers.id, id));
  if (!v) throw new UserError("Poukaz nenalezen.");
  if (v.redeemedAt) throw new UserError("Uplatněný poukaz už zrušit nejde.");
  await db.update(vouchers).set({ cancelledAt: now }).where(eq(vouchers.id, id));
}

/** Paid vouchers whose buyer hasn't been told yet (the 15-minute cron e-mails them). */
export const unnotifiedVouchers = (db: Executor) =>
  db
    .select({ v: vouchers, email: users.email, name: users.name })
    .from(vouchers)
    .innerJoin(users, eq(vouchers.buyerId, users.id))
    .where(and(isNotNull(vouchers.paidAt), isNull(vouchers.notifiedAt), isNull(vouchers.cancelledAt)));

export const markVoucherNotified = (db: Executor, id: string, now = new Date()) =>
  db.update(vouchers).set({ notifiedAt: now }).where(eq(vouchers.id, id));
