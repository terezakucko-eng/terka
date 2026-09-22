import { createDb, runMigrations } from "../src/db";

const h = createDb();
await runMigrations(h);
console.log(`✓ migrations applied (${h.kind})`);
await h.close();
