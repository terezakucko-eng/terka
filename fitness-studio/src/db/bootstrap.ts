import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { createDb, databaseUrl, runMigrations } from ".";
import { users } from "./schema";

/**
 * Server start-up for self-hosting (MIGRATE_ON_START=true): applies pending
 * migrations and, if there's no admin yet, creates one from ADMIN_EMAIL /
 * ADMIN_PASSWORD. Safe to run on every start.
 */
export async function bootstrap() {
  const h = createDb(databaseUrl());
  try {
    await runMigrations(h);
    console.log("[bootstrap] ✓ database migrated");
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) return;
    const [admin] = await h.db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
    if (admin) return;
    const [existing] = await h.db.select({ id: users.id }).from(users).where(eq(users.email, email));
    const passwordHash = await bcrypt.hash(password, 10);
    if (existing) {
      await h.db.update(users).set({ role: "admin", passwordHash }).where(eq(users.id, existing.id));
    } else {
      await h.db.insert(users).values({ email, name: "Recepce", role: "admin", passwordHash });
    }
    console.log(`[bootstrap] ✓ admin account ${email} ready`);
  } finally {
    await h.close();
  }
}
