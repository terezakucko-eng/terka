import { and, count, desc, eq, gt } from "drizzle-orm";
import type { Executor } from "@/db";
import { users, wishes, type User, type Wish } from "@/db/schema";
import { UserError } from "@/lib/errors";
import { displayName } from "@/lib/profile";

/**
 * 💌 Schránka přání a nápadů: clients write to the studio. They choose
 * whether a message may appear on the web (the studio publishes it) and
 * whether it is signed; the studio replies and marks it resolved.
 */

export const WISH_KINDS = {
  idea: { emoji: "💡", label: "Nápad" },
  wish: { emoji: "🙏", label: "Přání" },
  praise: { emoji: "🌟", label: "Pochvala" },
  concern: { emoji: "🌧️", label: "Něco mě trápí" },
} as const;
export type WishKind = keyof typeof WISH_KINDS;
export const isWishKind = (k: string): k is WishKind => k in WISH_KINDS;

export const MAX_WISH = 2000;
export const MAX_REPLY = 2000;
/** Messages per client and day – the box is for people, not for spam. */
export const DAILY_WISHES = 5;
const DAY = 86_400_000;

export async function submitWish(
  db: Executor,
  user: Pick<User, "id" | "name" | "nickname">,
  input: { kind: string; body: string; allowPublic: boolean; anonymous: boolean },
  now = new Date(),
): Promise<Wish> {
  if (!isWishKind(input.kind)) throw new UserError("Vyber, o jaký vzkaz jde.");
  const body = input.body.trim();
  if (body.length < 3) throw new UserError("Napiš nám prosím pár slov.");
  if (body.length > MAX_WISH) throw new UserError(`Vzkaz může mít nejvýš ${MAX_WISH} znaků.`);
  const [{ n }] = await db
    .select({ n: count() })
    .from(wishes)
    .where(and(eq(wishes.userId, user.id), gt(wishes.createdAt, new Date(now.getTime() - DAY))));
  if (n >= DAILY_WISHES) throw new UserError("Dnes už jsi nám napsal/a dost vzkazů – další pošli zase zítra. Děkujeme!");
  const [row] = await db
    .insert(wishes)
    .values({
      userId: user.id,
      kind: input.kind,
      body,
      allowPublic: input.allowPublic,
      anonymous: input.anonymous,
      signature: input.anonymous ? null : displayName(user),
      createdAt: now,
    })
    .returning();
  return row;
}

/** The client's own messages with the studio's replies, newest first. */
export const userWishes = (db: Executor, userId: string) =>
  db.select().from(wishes).where(eq(wishes.userId, userId)).orderBy(desc(wishes.createdAt));

/** Everything for the admin, newest first; the author stays hidden for anonymous ones. */
export async function adminWishes(db: Executor) {
  const rows = await db
    .select({ w: wishes, name: users.name, email: users.email })
    .from(wishes)
    .innerJoin(users, eq(wishes.userId, users.id))
    .orderBy(desc(wishes.createdAt));
  return rows.map((r) => ({ ...r.w, author: r.w.anonymous ? null : { id: r.w.userId, name: r.name, email: r.email } }));
}

export async function newWishCount(db: Executor) {
  const [{ n }] = await db.select({ n: count() }).from(wishes).where(eq(wishes.status, "new"));
  return n;
}

/** The admin opened the box – new messages count as read. */
export const markWishesRead = (db: Executor) => db.update(wishes).set({ status: "read" }).where(eq(wishes.status, "new"));

async function getWish(db: Executor, id: string) {
  const [w] = await db.select().from(wishes).where(eq(wishes.id, id));
  if (!w) throw new UserError("Vzkaz nenalezen.");
  return w;
}

export async function replyToWish(db: Executor, id: string, reply: string, now = new Date()) {
  const text = reply.trim();
  if (!text) throw new UserError("Napiš odpověď.");
  if (text.length > MAX_REPLY) throw new UserError(`Odpověď může mít nejvýš ${MAX_REPLY} znaků.`);
  const w = await getWish(db, id);
  const [row] = await db
    .update(wishes)
    .set({ reply: text, repliedAt: now, status: w.status === "new" ? "read" : w.status })
    .where(eq(wishes.id, id))
    .returning();
  return row;
}

export async function setWishResolved(db: Executor, id: string, resolved: boolean) {
  await getWish(db, id);
  await db.update(wishes).set({ status: resolved ? "resolved" : "read" }).where(eq(wishes.id, id));
}

/** Only messages the client allowed to be public can go on the web. */
export async function publishWish(db: Executor, id: string, on: boolean) {
  const w = await getWish(db, id);
  if (on && !w.allowPublic) throw new UserError("Klient si nepřeje, aby byl vzkaz veřejný.");
  await db.update(wishes).set({ published: on }).where(eq(wishes.id, id));
}

/** Published messages for the public page „Co jsme díky vám zlepšili“. */
export const publicWishes = (db: Executor, limit = 60) =>
  db
    .select({
      id: wishes.id,
      kind: wishes.kind,
      body: wishes.body,
      signature: wishes.signature,
      reply: wishes.reply,
      createdAt: wishes.createdAt,
    })
    .from(wishes)
    .where(and(eq(wishes.published, true), eq(wishes.allowPublic, true)))
    .orderBy(desc(wishes.createdAt))
    .limit(limit);
