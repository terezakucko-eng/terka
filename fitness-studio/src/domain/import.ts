import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import { entitlements, users } from "@/db/schema";
import { normalizePhone } from "@/lib/phone";
import { normalizeEmail } from "./users";
import { changeCredits } from "./wallet";

/** Placeholder hash – imported accounts can't log in until they set a password. */
export const IMPORTED_PASSWORD = "!imported";

/** Decodes an uploaded CSV: UTF-8 (with/without BOM) or Windows-1250 (older Czech Excel). */
export function decodeCsv(buf: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1250").decode(buf);
  }
}

/** Minimal RFC-4180 CSV parser; detects `;`, `,` or tab delimiter. */
export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = [";", ",", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  const delim = counts.sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Header aliases (without diacritics/spaces) for typical exports. */
const ALIASES = {
  fullName: ["jmenoaprijmeni", "celejmeno", "name", "fullname", "klient", "zakaznik", "uzivatel"],
  firstName: ["jmeno", "krestnijmeno", "firstname", "first"],
  lastName: ["prijmeni", "lastname", "surname", "last"],
  email: ["email", "mail", "emailovaadresa", "emailadresa"],
  phone: ["telefon", "tel", "phone", "mobil", "mobile", "telefonnicislo", "cislo"],
  credits: ["kredit", "kredity", "credit", "credits", "zustatek", "zustatekkreditu"],
  entries: ["vstupy", "zbyvajicivstupy", "zbyvavstupu", "permanentka", "pocetvstupu", "vstupu"],
  validUntil: ["platnostdo", "platnost", "platido", "expirace", "validuntil"],
  newsletter: ["newsletter", "souhlas", "souhlasnewsletter", "marketing", "gdpr", "souhlasgdpr"],
  note: ["poznamka", "note", "poznamky"],
} as const;

export type Field = keyof typeof ALIASES;
export type Mapping = Partial<Record<Field, number>>;

export function detectMapping(header: string[]): Mapping {
  const m: Mapping = {};
  header.forEach((h, i) => {
    const f = fold(h);
    for (const [field, aliases] of Object.entries(ALIASES) as [Field, readonly string[]][]) {
      if (m[field] === undefined && aliases.includes(f)) {
        m[field] = i;
        return;
      }
    }
  });
  return m;
}

const truthy = (v: string) => /^(1|a|ano|y|yes|true|x|✓|souhlas)$/i.test(v.trim());

/** "31.12.2026", "2026-12-31" → end of that day, Prague-ish (23:59 UTC+1). */
function parseDate(v: string): Date | null {
  const s = v.trim();
  let m = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(s);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 22, 59));
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 22, 59));
  return null;
}

export type ImportRow = {
  line: number;
  name: string;
  email: string | null;
  phone: string | null;
  credits: number;
  entries: number;
  validUntil: Date | null;
  newsletter: boolean;
  note: string | null;
  problem?: string;
};

export function interpretRows(rows: string[][], mapping: Mapping): ImportRow[] {
  const get = (r: string[], f: Field) => (mapping[f] !== undefined ? (r[mapping[f]!] ?? "").trim() : "");
  return rows.map((r, i) => {
    const name =
      get(r, "fullName") || [get(r, "firstName"), get(r, "lastName")].filter(Boolean).join(" ");
    const rawEmail = get(r, "email");
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? normalizeEmail(rawEmail) : null;
    const rawPhone = get(r, "phone");
    const phone = normalizePhone(rawPhone);
    const num = (v: string) => Math.max(0, Math.floor(Number(v.replace(",", ".")) || 0));
    const row: ImportRow = {
      line: i + 2,
      name: name || (email ?? "").split("@")[0],
      email,
      phone,
      credits: num(get(r, "credits")),
      entries: num(get(r, "entries")),
      validUntil: parseDate(get(r, "validUntil")),
      newsletter: truthy(get(r, "newsletter")),
      note: get(r, "note") || null,
    };
    if (!email) row.problem = rawEmail ? `neplatný e-mail „${rawEmail}“` : "chybí e-mail";
    else if (rawPhone && !phone) row.problem = `telefon „${rawPhone}“ nerozpoznán – přeskočen`;
    return row;
  });
}

export type ImportResult = {
  created: number;
  updated: number;
  skipped: { line: number; reason: string }[];
  credits: number;
  passes: number;
};

/**
 * Imports clients. Idempotent: existing e-mails only get missing contact
 * data filled in – credit and passes are transferred for new accounts only,
 * so running the same file twice never doubles balances.
 */
export async function importClients(
  db: DB,
  rows: ImportRow[],
  opts: { consentFromFile: boolean; smsConsentAll?: boolean },
  now = new Date(),
): Promise<ImportResult> {
  const res: ImportResult = { created: 0, updated: 0, skipped: [], credits: 0, passes: 0 };
  const seen = new Set<string>();
  for (const r of rows) {
    if (!r.email) {
      res.skipped.push({ line: r.line, reason: r.problem ?? "chybí e-mail" });
      continue;
    }
    if (seen.has(r.email)) {
      res.skipped.push({ line: r.line, reason: "duplicitní e-mail v souboru" });
      continue;
    }
    seen.add(r.email);

    await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(users).where(eq(users.email, r.email!));
      if (existing) {
        await tx
          .update(users)
          .set({
            phone: existing.phone ?? r.phone,
            adminNote: existing.adminNote ?? r.note,
          })
          .where(eq(users.id, existing.id));
        res.updated++;
        return;
      }
      const [u] = await tx
        .insert(users)
        .values({
          email: r.email!,
          name: r.name || r.email!,
          phone: r.phone,
          passwordHash: IMPORTED_PASSWORD,
          importedAt: now,
          adminNote: r.note,
          marketingConsent: opts.consentFromFile && r.newsletter,
          smsConsent: !!opts.smsConsentAll && !!r.phone && opts.consentFromFile && r.newsletter,
        })
        .returning();
      res.created++;
      if (r.credits > 0) {
        await changeCredits(tx, {
          userId: u.id,
          delta: r.credits,
          reason: "admin",
          note: "Převod ze starého systému",
        });
        res.credits += r.credits;
      }
      if (r.entries > 0) {
        const until =
          r.validUntil && r.validUntil > now ? r.validUntil : new Date(now.getTime() + 90 * 86_400_000);
        await tx.insert(entitlements).values({
          userId: u.id,
          kind: "pass",
          name: "Permanentka (převod)",
          entriesTotal: r.entries,
          validFrom: now,
          validUntil: until,
          note: "Převedeno ze starého systému",
        });
        res.passes++;
      }
    });
  }
  return res;
}
