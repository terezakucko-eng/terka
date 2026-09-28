import "server-only";
import { cache } from "react";
import { getDb } from "@/db";
import { content } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { SECTIONS, fieldDef, type ContentKey, type SectionDef, type SectionId } from "./definitions";
import { nbsp } from "@/lib/typography";

export function fillPlaceholders(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{(\w+)\}\}/g, (m, k: string) => vars[k] ?? m);
}

/**
 * Loads all editable content once per request.
 * `c("pricing.title")` → the saved text, or the default from definitions.ts.
 */
export const getContent = cache(async () => {
  const db = await getDb();
  const [rows, cfg] = await Promise.all([db.select().from(content), getSettings(db)]);
  const saved = new Map(rows.map((r) => [r.key, r.value]));
  const raw = (key: string) => saved.get(key) ?? fieldDef(key)?.default ?? "";
  const vars: Record<string, string> = {
    storno_hodin: String(cfg.cancellationHours),
    prohresky: String(cfg.memberStrikeLimit),
    prohresky_dni: String(cfg.memberStrikeWindowDays),
    pauza_dni: String(cfg.memberPauseDays),
    rezervace_dni: String(cfg.bookingWindowDays),
    rezervace_dni_clenove: String(Math.max(cfg.memberBookingWindowDays, cfg.bookingWindowDays)),
    platba_minut: String(cfg.pendingPaymentMinutes),
    vstupy_zdarma: String(cfg.welcomeFreeEntries),
    platnost_zdarma: String(cfg.welcomeFreeValidityDays),
    firma: raw("site.companyName"),
    ico: raw("site.ico"),
    adresa: `${raw("site.street")}, ${raw("site.zip")} ${raw("site.city")}`,
    email: raw("site.email"),
    telefon: raw("site.phone"),
  };
  const c = (key: ContentKey | `${SectionId}.${string}`) => nbsp(fillPlaceholders(raw(key), vars));
  c.raw = raw;
  /** Fills the global placeholders (plus `extra`) without typography tweaks – for e-mails. */
  c.fill = (text: string, extra: Record<string, string> = {}) => fillPlaceholders(text, { ...vars, ...extra });
  c.isSaved = (key: string) => saved.has(key);
  return c;
});

export type Content = Awaited<ReturnType<typeof getContent>>;

/** Section values for the admin editor (raw, without placeholders filled). */
export async function sectionValues(id: string) {
  const c = await getContent();
  const section = (SECTIONS as Record<string, SectionDef>)[id];
  return Object.fromEntries(Object.keys(section.fields).map((f) => [f, c.raw(`${id}.${f}`)]));
}
