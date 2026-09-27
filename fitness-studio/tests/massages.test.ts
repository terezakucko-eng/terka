import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { massageServices } from "@/db/schema";
import {
  addAvailability,
  adminBookMassage,
  bookMassage,
  cancelMassage,
  computeSlots,
  removeAvailability,
} from "@/domain/massages";
import { grantEntitlement } from "@/domain/users";
import { pragueLocalToDate } from "@/lib/dates";
import { czIban, spdPayload } from "@/lib/qr-payment";
import { NOW, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const at = (hm: string, day = "2026-10-06") => pragueLocalToDate(`${day}T${hm}`);

async function service(durationMin = 60) {
  const [s] = await h.db
    .insert(massageServices)
    .values({ name: `Masáž ${durationMin}`, slug: `m-${Math.random()}`, durationMin, price: 90000 })
    .returning();
  return s;
}

describe("slot computation", () => {
  it("offers start times inside windows, respecting bookings and buffer", () => {
    const slots = computeSlots({
      windows: [{ startsAt: at("14:00"), endsAt: at("17:00") }],
      booked: [{ startsAt: at("15:00"), endsAt: at("16:00") }],
      durationMin: 60,
      stepMin: 30,
      bufferMin: 15,
      notBefore: NOW,
    });
    // 14:00 ends 15:00 → clashes with buffer; 16:30 ends 17:30 → outside window
    expect(slots.map((d) => d.toISOString())).toEqual([]);
    const free = computeSlots({
      windows: [{ startsAt: at("14:00"), endsAt: at("18:00") }],
      booked: [{ startsAt: at("15:00"), endsAt: at("16:00") }],
      durationMin: 60,
      stepMin: 30,
      bufferMin: 0,
      notBefore: NOW,
    });
    expect(free).toEqual([at("14:00"), at("16:00"), at("16:30"), at("17:00")]);
  });
});

describe("booking massages", () => {
  it("books inside a window and blocks overlapping times", async () => {
    const s = await service(60);
    await addAvailability(h.db, { date: "2026-10-06", from: "09:00", to: "12:00", weeks: 1 });
    const u1 = await makeUser(h.db);
    const u2 = await makeUser(h.db);
    const b = await bookMassage(h.db, { userId: u1.id, serviceId: s.id, startsAt: at("09:00"), payment: "transfer" }, NOW);
    expect(b.variableSymbol).toBeGreaterThan(10000);
    expect(+b.endsAt - +b.startsAt).toBe(3_600_000);
    // 10:00 is inside the 15 min buffer after 09:00–10:00
    await expect(
      bookMassage(h.db, { userId: u2.id, serviceId: s.id, startsAt: at("10:00"), payment: "on_site" }, NOW),
    ).rejects.toThrow(/obsazený/);
    await bookMassage(h.db, { userId: u2.id, serviceId: s.id, startsAt: at("10:30"), payment: "on_site" }, NOW);
    // outside any window
    await expect(
      bookMassage(h.db, { userId: u2.id, serviceId: s.id, startsAt: at("12:30"), payment: "on_site" }, NOW),
    ).rejects.toThrow(/nemasíruje/);
    // the window can't be removed while it holds bookings
    const [w] = await h.db.query.massageAvailability.findMany();
    await expect(removeAvailability(h.db, w.id)).rejects.toThrow(/rezervovaná/);
  });

  it("reception can book outside windows but not over another booking", async () => {
    const s = await service(30);
    await adminBookMassage(h.db, { serviceId: s.id, startsAt: at("20:00", "2026-10-07"), payment: "on_site", guest: { name: "Host" } });
    await expect(
      adminBookMassage(h.db, { serviceId: s.id, startsAt: at("20:15", "2026-10-07"), payment: "on_site", guest: { name: "Host 2" } }),
    ).rejects.toThrow(/obsazený/);
  });

  it("clients cancel only before the storno limit, staff any time", async () => {
    const s = await service(60);
    await addAvailability(h.db, { date: "2026-10-05", from: "14:00", to: "18:00", weeks: 1 });
    const u = await makeUser(h.db);
    // NOW = 2026-10-05 10:00 Prague; 14:00 is 4 h ahead < 12 h storno
    const b = await bookMassage(h.db, { userId: u.id, serviceId: s.id, startsAt: at("14:00", "2026-10-05"), payment: "on_site" }, NOW);
    await expect(cancelMassage(h.db, { bookingId: b.id, actorId: u.id }, NOW)).rejects.toThrow(/nejpozději/);
    const c = await cancelMassage(h.db, { bookingId: b.id, actorId: "staff", staff: true }, NOW);
    expect(c.status).toBe("cancelled");
  });

  it("weekly availability skips overlaps", async () => {
    const n1 = await addAvailability(h.db, { date: "2026-11-02", from: "09:00", to: "11:00", weeks: 3 });
    const n2 = await addAvailability(h.db, { date: "2026-11-02", from: "10:00", to: "12:00", weeks: 4 });
    expect([n1, n2]).toEqual([3, 1]);
  });
});

describe("member prices", () => {
  it("members pay the member price, others the single price", async () => {
    const [s] = await h.db
      .insert(massageServices)
      .values({ name: "Sportovní", slug: "sport-m", durationMin: 60, price: 90000, memberPrice: 70000 })
      .returning();
    await addAvailability(h.db, { date: "2026-10-08", from: "09:00", to: "13:00", weeks: 1 });
    const member = await makeUser(h.db);
    await grantEntitlement(h.db, { userId: member.id, kind: "membership", name: "Členství", entries: null, validityDays: 30 }, NOW);
    const guest = await makeUser(h.db);
    const bm = await bookMassage(h.db, { userId: member.id, serviceId: s.id, startsAt: at("09:00", "2026-10-08"), payment: "on_site" }, NOW);
    const bg = await bookMassage(h.db, { userId: guest.id, serviceId: s.id, startsAt: at("11:00", "2026-10-08"), payment: "on_site" }, NOW);
    expect([bm.price, bm.memberRate]).toEqual([70000, true]);
    expect([bg.price, bg.memberRate]).toEqual([90000, false]);
    const forced = await adminBookMassage(h.db, {
      serviceId: s.id, startsAt: at("18:00", "2026-10-08"), payment: "on_site", memberRate: true, guest: { name: "Host" },
    });
    expect(forced.price).toBe(70000);
  });
});

describe("QR payment", () => {
  it("converts Czech account numbers to IBAN", () => {
    expect(czIban("19-2000145399/0800")).toBe("CZ6508000000192000145399");
    expect(czIban("nesmysl")).toBeNull();
    expect(spdPayload({ iban: "CZ6508000000192000145399", amountHalere: 90000, vs: 10001, message: "Masáž" })).toBe(
      "SPD*1.0*ACC:CZ6508000000192000145399*AM:900.00*CC:CZK*X-VS:10001*MSG:Masaz",
    );
  });
});
