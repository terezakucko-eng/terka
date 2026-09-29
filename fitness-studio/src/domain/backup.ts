import { gunzipSync, gzipSync } from "node:zlib";
import { and, desc, eq, getTableColumns, is, notInArray } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import type { Executor } from "@/db";
import * as schema from "@/db/schema";
import { backups, media, settings } from "@/db/schema";

const DAY = 86_400_000;
/** Weekly backups kept (manual ones are kept until deleted). */
export const KEEP_AUTO = 8;

const tables = () =>
  (Object.values(schema) as unknown[])
    .filter((t): t is PgTable => is(t, PgTable) && t !== backups)
    .map((t) => ({ table: t, name: getTableConfig(t).name }));

/**
 * Snapshot of every table as gzipped JSON (for download and a manual restore
 * if ever needed). Uploaded pictures keep only their metadata – their bytes
 * would make each backup many times larger.
 */
export async function createBackup(db: Executor, kind: "auto" | "manual") {
  const out: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const { table, name } of tables()) {
    let rows: unknown[];
    if (table === media) {
      const { data: _data, ...cols } = getTableColumns(media);
      void _data;
      rows = await db.select(cols).from(media);
    } else if (table === settings) {
      // the push notification signing key stays out of downloadable files
      rows = (await db.select().from(settings)).filter((r) => r.key !== "vapid");
    } else {
      rows = await db.select().from(table);
    }
    out[name] = rows;
    counts[name] = rows.length;
  }
  const data = gzipSync(JSON.stringify({ app: "octopush", version: 1, createdAt: new Date(), tables: out }));
  const [b] = await db
    .insert(backups)
    .values({ kind, size: data.length, counts, data })
    .returning({ id: backups.id, createdAt: backups.createdAt, size: backups.size });
  if (kind === "auto") await pruneBackups(db);
  return b;
}

async function pruneBackups(db: Executor) {
  const keep = await db
    .select({ id: backups.id })
    .from(backups)
    .where(eq(backups.kind, "auto"))
    .orderBy(desc(backups.createdAt))
    .limit(KEEP_AUTO);
  if (keep.length < KEEP_AUTO) return;
  await db.delete(backups).where(and(eq(backups.kind, "auto"), notInArray(backups.id, keep.map((k) => k.id))));
}

/** Cron: a new automatic backup when the last one is at least ~a week old. */
export async function weeklyBackupDue(db: Executor, now = new Date()) {
  const [last] = await db
    .select({ at: backups.createdAt })
    .from(backups)
    .where(eq(backups.kind, "auto"))
    .orderBy(desc(backups.createdAt))
    .limit(1);
  return !last || now.getTime() - last.at.getTime() > 6.5 * DAY;
}

export async function listBackups(db: Executor) {
  return db
    .select({ id: backups.id, kind: backups.kind, size: backups.size, counts: backups.counts, createdAt: backups.createdAt })
    .from(backups)
    .orderBy(desc(backups.createdAt));
}

export async function backupFile(db: Executor, id: string) {
  const [b] = await db.select().from(backups).where(eq(backups.id, id));
  return b ?? null;
}

/** Parsed content of a backup (tests, manual restore). */
export const readBackup = (data: Buffer) =>
  JSON.parse(gunzipSync(data).toString("utf8")) as { app: string; version: number; createdAt: string; tables: Record<string, Record<string, unknown>[]> };
