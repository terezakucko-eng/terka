import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { entitlements, users } from "@/db/schema";
import { INVITED_PASSWORD, createClientByStudio, registerUser } from "@/domain/users";
import { NOW, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("an account the studio creates", () => {
  it("has no password until the client sets it, keeps phone and birthday, gets the welcome entry", async () => {
    const u = await createClientByStudio(h.db, { name: "  Jana   Testová ", email: " Jana.Testova@Example.cz ", phone: "732 000 111", birthDate: "1980-05-01" }, NOW);
    const [row] = await h.db.select().from(users).where(eq(users.id, u.id));
    expect(row).toMatchObject({ name: "Jana Testová", email: "jana.testova@example.cz", phone: "+420732000111", birthDate: "1980-05-01", passwordHash: INVITED_PASSWORD });
    expect(await h.db.select().from(entitlements).where(eq(entitlements.userId, u.id))).toHaveLength(1);

    await expect(createClientByStudio(h.db, { name: "Jana Testová", email: "jana.testova@example.cz" }, NOW)).rejects.toThrow("už existuje");
    // she registers on the web herself instead of using the link
    await expect(registerUser(h.db, { email: "jana.testova@example.cz", name: "Jana", passwordHash: "x" }, NOW)).rejects.toThrow("Zapomenuté heslo");
  });

  it("checks what the reception typed", async () => {
    await expect(createClientByStudio(h.db, { name: "Jo", email: "jo@example.cz" }, NOW)).rejects.toThrow("jméno");
    await expect(createClientByStudio(h.db, { name: "Eva Nová", email: "eva@" }, NOW)).rejects.toThrow("e-mail");
    await expect(createClientByStudio(h.db, { name: "Eva Nová", email: "eva@example.cz", phone: "12" }, NOW)).rejects.toThrow("telefon");
    await expect(createClientByStudio(h.db, { name: "Eva Nová", email: "eva@example.cz", birthDate: "2030-01-01" }, NOW)).rejects.toThrow("narození");
  });
});
