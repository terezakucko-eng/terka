import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const sent: string[] = [];
vi.mock("@/lib/email-templates", () => ({ sendEmail: vi.fn(async (_to: string, id: string) => void sent.push(id)) }));
vi.mock("@/lib/push", () => ({ pushQuietly: vi.fn(async () => 0) }));

const { users } = await import("@/db/schema");
const { notifyBooked, notifyCancelled, notifySessionCancelled } = await import("@/lib/notify");
const { makeSession, makeUser, testDb } = await import("./helpers");

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());
beforeEach(() => void (sent.length = 0));

describe("booking confirmation e-mails", () => {
  it("are skipped when the client turned them off, except what the studio did", async () => {
    const u = await makeUser(h.db);
    const s = await makeSession(h.db, {});
    await h.db.update(users).set({ bookingEmails: false }).where(eq(users.id, u.id));

    await notifyBooked(h.db, { userId: u.id, sessionId: s.id });
    await notifyCancelled(h.db, { userId: u.id, sessionId: s.id }, true);
    expect(sent).toEqual([]);

    await notifyBooked(h.db, { userId: u.id, sessionId: s.id }, true); // added by the reception
    await notifySessionCancelled(h.db, s.id, [u.id]);
    expect(sent).toEqual(["booked", "sessionCancelled"]);
  });

  it("are sent by default", async () => {
    const u = await makeUser(h.db);
    const s = await makeSession(h.db, {});
    await notifyBooked(h.db, { userId: u.id, sessionId: s.id });
    await notifyCancelled(h.db, { userId: u.id, sessionId: s.id }, false);
    expect(sent).toEqual(["booked", "cancelled"]);
  });
});
