/**
 * Runs before `next build`. With a real database configured (Vercel + Neon)
 * it applies migrations, and with SEED_DEMO=true fills demo data once.
 * Without a database (CI, local) it does nothing.
 */
import { execFileSync } from "node:child_process";
import { createDb, databaseUrl, runMigrations } from "../src/db";

const url = databaseUrl();
if (!/^postgres(ql)?:\/\//.test(url)) {
  console.log("prebuild: no DATABASE_URL – skipping migrations");
  process.exit(0);
}

const h = createDb(url);
await runMigrations(h);
await h.close();
console.log("prebuild: ✓ migrations applied");

if (process.env.SEED_DEMO === "true") {
  execFileSync("npx", ["tsx", "scripts/seed.mts"], { stdio: "inherit" });
}
