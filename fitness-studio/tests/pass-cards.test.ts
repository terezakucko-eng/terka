import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { entitlements, passCards } from "@/db/schema";
import { addPassCard, cardHeldBy, listPassCards, passCardByCode, passCardOf, setPassCardActive } from "@/domain/pass-cards";
import { registerUser } from "@/domain/users";
import { passCardsPdf } from "@/lib/pass-card-pdf";
import { NOW, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

let n = 0;
const signUp = (name: string, passCard?: string) =>
  registerUser(h.db, { email: `card${++n}@test.cz`, name, passwordHash: "x", passCard }, NOW);
const free = async (userId: string) => (await h.db.select().from(entitlements).where(eq(entitlements.userId, userId)))[0];

describe("Pošli to dál cards", () => {
  it("the migration puts four cards into the game, and only once", async () => {
    const seed = readFileSync("drizzle/0094_pass_cards_seed.sql", "utf8");
    await h.db.execute(sql.raw(seed));
    const cards = await h.db.select().from(passCards);
    expect(cards.map((c) => c.label).sort()).toEqual(["Kartička 1", "Kartička 2", "Kartička 3", "Kartička 4"]);
    expect(cards.every((c) => /^[0-9A-F]{6}$/.test(c.code) && c.isActive && !c.holderId)).toBe(true);
  });

  it("a newcomer with the card gets two free lessons and the card passes to her; the next one gets it from her", async () => {
    const card = await addPassCard(h.db);
    expect(card.label).toBe("Kartička 5");

    const jana = await signUp("Jana Nováková", card.code.toLowerCase());
    expect(await free(jana.id)).toMatchObject({ kind: "free", entriesTotal: 2, name: "Lekce zdarma – Pošli to dál 💛" });
    expect(await cardHeldBy(h.db, jana.id)).toMatchObject({ id: card.id, people: 1 });

    const eva = await signUp("Eva Malá", card.code);
    expect(await cardHeldBy(h.db, jana.id)).toBeNull();
    expect(await cardHeldBy(h.db, eva.id)).toMatchObject({ id: card.id, people: 2 });
    expect(await passCardOf(h.db, eva.id)).toMatchObject({ label: "Kartička 5", fromId: jana.id, fromName: "Jana Nováková" });
    // the QR page shows only her first name
    expect(await passCardByCode(h.db, card.code)).toMatchObject({ holder: "Eva", people: 2, isActive: true });

    const listed = (await listPassCards(h.db)).find((c) => c.id === card.id)!;
    expect(listed.holderName).toBe("Eva Malá");
    expect(listed.chain.map((u) => [u.name, u.fromName])).toEqual([["Jana Nováková", null], ["Eva Malá", "Jana Nováková"]]);
  });

  it("a card out of the game, or a made-up code, is an ordinary sign-up with the one welcome lesson", async () => {
    const card = await addPassCard(h.db);
    await setPassCardActive(h.db, card.id, false);
    const a = await signUp("Alena Prvá", card.code);
    const b = await signUp("Bára Druhá", "ZZZZZZ");
    expect([(await free(a.id)).entriesTotal, (await free(b.id)).entriesTotal]).toEqual([1, 1]);
    expect((await free(a.id)).name).toBe("Úvodní lekce zdarma");
    expect(await passCardOf(h.db, a.id)).toBeNull();
    expect((await passCardByCode(h.db, card.code))?.isActive).toBe(false);
    expect(await passCardByCode(h.db, "nope")).toBeNull();
  });

  it("prints front and back of every card", async () => {
    const bytes = await passCardsPdf(
      [
        { label: "Kartička 1", code: "7F3A9C", url: "https://www.octopush.fit/karticka/7F3A9C" },
        { label: "Kartička 2", code: "0B12EE", url: "https://www.octopush.fit/karticka/0B12EE" },
      ],
      2,
      "OCTOPUSH · Pospolitá 699/16, Ostrava",
    );
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(4);
    // 85 × 55 mm with 3 mm bleed
    expect(doc.getPage(0).getSize().width).toBeCloseTo((91 * 72) / 25.4, 1);
  });
});
