import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const sent: string[] = [];
vi.mock("web-push", async (orig) => {
  const real = (await orig()) as { default: { generateVAPIDKeys: () => { publicKey: string; privateKey: string } } };
  return {
    default: {
      generateVAPIDKeys: real.default.generateVAPIDKeys,
      sendNotification: vi.fn(async (sub: { endpoint: string }) => {
        if (sub.endpoint.includes("gone")) throw Object.assign(new Error("gone"), { statusCode: 410 });
        sent.push(sub.endpoint);
      }),
    },
  };
});

const { pushSubscriptions, settings } = await import("@/db/schema");
const { sendPush, vapidKeys } = await import("@/lib/push");
const { createBackup, readBackup, backupFile } = await import("@/domain/backup");
const { makeUser, testDb } = await import("./helpers");

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("push notifications", () => {
  it("generates the key pair once and keeps it out of backups", async () => {
    const a = await vapidKeys(h.db);
    expect(a.publicKey).toMatch(/^[A-Za-z0-9_-]{80,}$/);
    const rows = await h.db.select().from(settings);
    expect(rows.find((r) => r.key === "vapid")).toBeTruthy();
    const b = await createBackup(h.db, "manual");
    const content = readBackup((await backupFile(h.db, b.id))!.data);
    expect(content.tables.settings.some((r) => r.key === "vapid")).toBe(false);
  });

  it("sends to all devices of the clients and drops expired ones", async () => {
    const u = await makeUser(h.db);
    const other = await makeUser(h.db);
    await h.db.insert(pushSubscriptions).values([
      { userId: u.id, endpoint: "https://push.example/phone", p256dh: "k", auth: "a" },
      { userId: u.id, endpoint: "https://push.example/gone", p256dh: "k", auth: "a" },
      { userId: other.id, endpoint: "https://push.example/other", p256dh: "k", auth: "a" },
    ]);
    const n = await sendPush(h.db, [u.id], { title: "Test", body: "Ahoj" });
    expect(n).toBe(1);
    expect(sent).toEqual(["https://push.example/phone"]);
    const left = await h.db.select().from(pushSubscriptions);
    expect(left.map((s) => s.endpoint).sort()).toEqual(["https://push.example/other", "https://push.example/phone"]);
  });
});
