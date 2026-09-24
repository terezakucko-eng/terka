import { createDb, runMigrations } from "@/db";
import {
  classSessions,
  classTypes,
  products,
  users,
  type ClassSession,
} from "@/db/schema";
import { saveSettings } from "@/lib/settings";

export async function testDb() {
  const h = createDb("pglite://memory");
  await runMigrations(h);
  // deterministic rules for tests
  await saveSettings(h.db, {
    cancellationHours: 12,
    bookingWindowDays: 30,
    welcomeFreeEntries: 1,
  });
  return h;
}

export const NOW = new Date("2026-10-05T08:00:00Z");
export const hours = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

let n = 0;
export async function makeUser(db: Awaited<ReturnType<typeof testDb>>["db"], credits = 0) {
  const [u] = await db
    .insert(users)
    .values({
      email: `u${++n}@test.cz`,
      name: `Klient ${n}`,
      passwordHash: "x",
      creditBalance: credits,
    })
    .returning();
  return u;
}

export async function makeSession(
  db: Awaited<ReturnType<typeof testDb>>["db"],
  over: Partial<typeof classSessions.$inferInsert> = {},
): Promise<ClassSession> {
  const [ct] = await db
    .insert(classTypes)
    .values({ name: "Pilates", slug: `pilates-${++n}` })
    .returning();
  const [s] = await db
    .insert(classSessions)
    .values({
      classTypeId: ct.id,
      startsAt: hours(48),
      durationMin: 60,
      capacity: 2,
      creditCost: 1,
      dropInPrice: 25000,
      ...over,
    })
    .returning();
  return s;
}

export async function makeProduct(
  db: Awaited<ReturnType<typeof testDb>>["db"],
  over: Partial<typeof products.$inferInsert> & Pick<typeof products.$inferInsert, "kind">,
) {
  const [p] = await db
    .insert(products)
    .values({ name: "Produkt", price: 100000, ...over })
    .returning();
  return p;
}
