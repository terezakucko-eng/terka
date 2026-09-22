import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Both drivers expose the same query-builder API, so the app is typed against
 * the node-postgres flavour and PGlite (embedded Postgres for local dev/tests)
 * is cast to it.
 */
export type DB = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type Executor = DB | Tx;

type Handle = { db: DB; kind: "pg" | "pglite"; close: () => Promise<void> };

/**
 * `postgres://…` → real PostgreSQL (production)
 * `pglite://memory` → in-memory embedded Postgres (tests)
 * `pglite://./.data/db` or empty → embedded Postgres on disk (local dev)
 */
export function createDb(url = process.env.DATABASE_URL ?? ""): Handle {
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    const pool = new Pool({ connectionString: url, max: 5 });
    return {
      db: drizzlePg(pool, { schema }),
      kind: "pg",
      close: () => pool.end(),
    };
  }
  const target = url.replace(/^pglite:\/\//, "") || "./.data/db";
  if (target !== "memory") fs.mkdirSync(target, { recursive: true });
  const client = target === "memory" ? new PGlite() : new PGlite(target);
  return {
    db: drizzlePglite(client, { schema }) as unknown as DB,
    kind: "pglite",
    close: () => client.close(),
  };
}

export const migrationsFolder = path.join(process.cwd(), "drizzle");

export async function runMigrations(handle: Handle) {
  if (handle.kind === "pg") {
    await migratePg(handle.db, { migrationsFolder });
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migratePglite(handle.db as any, { migrationsFolder });
  }
}

const globalForDb = globalThis as unknown as {
  __db?: Handle;
  __dbReady?: Promise<void>;
};

function handle(): Handle {
  if (!globalForDb.__db) {
    globalForDb.__db = createDb();
    // Embedded dev database migrates itself so `npm run dev` just works.
    if (globalForDb.__db.kind === "pglite") {
      globalForDb.__dbReady = runMigrations(globalForDb.__db);
    }
  }
  return globalForDb.__db;
}

/**
 * Tells Next.js the caller needs a live request, so pages that read the DB are
 * never prerendered at build time. Outside a request (scripts, tests) it's a no-op.
 */
async function requireRequest() {
  try {
    const { connection } = await import("next/server");
    await connection();
  } catch (e) {
    const { unstable_rethrow } = await import("next/navigation");
    unstable_rethrow(e); // let Next's "render dynamically" signal through
  }
}

/** Lazily-initialised app-wide database. */
export async function getDb(): Promise<DB> {
  await requireRequest();
  const h = handle();
  if (globalForDb.__dbReady) await globalForDb.__dbReady;
  return h.db;
}

export { schema };
