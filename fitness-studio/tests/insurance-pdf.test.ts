import { writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { confirmationPdf } from "@/lib/insurance-pdf";

const months = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září"];
const doc = (n: number, birthDate: string | null) => ({
  provider: { company: "MOVE IN ZONE s.r.o.", ico: "06593674", address: "Pospolitá 699/16, 700 30 Ostrava", city: "Ostrava", email: "ahoj@octopush.fit", phone: "+420 724 443 766", web: "https://www.octopush.fit" },
  client: { name: "Martina Paulík", birthDate },
  year: 2026,
  items: Array.from({ length: n }, (_, i) => ({
    date: new Date(Date.UTC(2026, i % 12, 1, 11)),
    description: `Členský příspěvek – ${months[i % 9]} 2026`,
    amount: 100000,
  })),
  total: n * 100000,
  code: "7KQ4-M2PX",
  issuedAt: new Date("2026-10-12T10:00:00Z"),
  verifyUrl: "https://www.octopush.fit/overeni?kod=7KQ4M2PX",
});
const pages = async (b: Uint8Array) => (await PDFDocument.load(b)).getPageCount();

describe("insurance confirmation PDF", () => {
  it("fits a year of monthly fees on one A4 page and grows for long lists", async () => {
    const one = await confirmationPdf(doc(9, "1990-03-12"));
    if (process.env.PDF_OUT) {
      await writeFile(`${process.env.PDF_OUT}/a.pdf`, one);
      await writeFile(`${process.env.PDF_OUT}/b.pdf`, await confirmationPdf(doc(14, null)));
      await writeFile(`${process.env.PDF_OUT}/c.pdf`, await confirmationPdf(doc(60, null)));
    }
    expect(Buffer.from(one.slice(0, 5)).toString()).toBe("%PDF-");
    expect(await pages(one)).toBe(1);
    expect(await pages(await confirmationPdf(doc(14, null)))).toBe(1);
    expect(await pages(await confirmationPdf(doc(60, null)))).toBeGreaterThan(1);
  });
});
