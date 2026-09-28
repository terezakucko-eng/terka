import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { backups, media } from "@/db/schema";
import { KEEP_AUTO, backupFile, createBackup, listBackups, readBackup, weeklyBackupDue } from "@/domain/backup";
import { makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("backups", () => {
  it("stores every table (without picture bytes) and reads back", async () => {
    const u = await makeUser(h.db);
    await h.db.insert(media).values({ filename: "a.webp", mime: "image/webp", size: 3, data: Buffer.from("abc") });
    expect(await weeklyBackupDue(h.db)).toBe(true);

    const b = await createBackup(h.db, "auto");
    const file = await backupFile(h.db, b.id);
    const content = readBackup(file!.data);
    expect(content.app).toBe("octopush");
    expect(content.tables.users.some((r) => r.id === u.id)).toBe(true);
    expect(content.tables.media[0]).toMatchObject({ filename: "a.webp" });
    expect(content.tables.media[0]).not.toHaveProperty("data");
    expect(content.tables).not.toHaveProperty("backups");
    expect(file!.counts.users).toBeGreaterThan(0);

    expect(await weeklyBackupDue(h.db)).toBe(false);
    expect(await weeklyBackupDue(h.db, new Date(Date.now() + 7 * 86_400_000))).toBe(true);
  });

  it("keeps only the latest weekly backups, manual ones stay", async () => {
    await createBackup(h.db, "manual");
    for (let i = 0; i < KEEP_AUTO + 2; i++) await createBackup(h.db, "auto");
    const list = await listBackups(h.db);
    expect(list.filter((b) => b.kind === "auto")).toHaveLength(KEEP_AUTO);
    expect(list.filter((b) => b.kind === "manual")).toHaveLength(1);
    await h.db.delete(backups).where(eq(backups.kind, "manual"));
  });
});
