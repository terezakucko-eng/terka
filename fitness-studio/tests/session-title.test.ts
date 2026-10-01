import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listSessions, sessionDetail } from "@/lib/queries";
import { NOW, hours, makeSession, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(() => h.close());

describe("session title", () => {
  it("a session's own title replaces the lesson name, empty keeps it", async () => {
    const own = await makeSession(h.db, { title: "Dýňový brunch" });
    const plain = await makeSession(h.db, { title: "  " });
    const list = await listSessions(h.db, NOW, hours(72));
    expect(list.find((s) => s.id === own.id)?.classType.name).toBe("Dýňový brunch");
    expect(list.find((s) => s.id === plain.id)?.classType.name).toBe("Pilates");
    expect((await sessionDetail(h.db, own.id))?.ct.name).toBe("Dýňový brunch");
  });
});
