import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Cheap protection of public forms against spam bots, without a captcha:
 * a hidden "leave empty" field, a signed timestamp (bots submit in well under
 * a few seconds) and a couple of tell-tale patterns seen in bot sign-ups.
 */

export const HONEYPOT = "website";
export const STAMP = "stamp";
const MIN_MS = 3_000;
const MAX_MS = 24 * 3_600_000;

function sign(ts: string) {
  const key = process.env.AUTH_SECRET ?? "dev-only-secret-change-me-please-0123456789";
  return createHmac("sha256", key).update(`form:${ts}`).digest("hex").slice(0, 32);
}

/** Token the page renders into the form; proves when the form was shown. */
export function formStamp(now = Date.now()) {
  const ts = String(now);
  return `${ts}.${sign(ts)}`;
}

export function stampOk(token: string, now = Date.now()) {
  const [ts, mac] = token.split(".");
  if (!ts || !mac || !/^\d+$/.test(ts)) return false;
  const want = Buffer.from(sign(ts));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return false;
  const age = now - Number(ts);
  return age >= MIN_MS && age <= MAX_MS;
}

/** A single word like "jzTeFvVbtGUGxqKTtDNyCJ" – random letters with case flipping all over. */
export function gibberishName(name: string) {
  const words = name.trim().split(/\s+/);
  return words.some((w) => {
    if (w.length < 8) return false;
    const flips = [...w].filter((ch, i) => i > 0 && /\p{Lu}/u.test(ch) && /\p{Ll}/u.test(w[i - 1])).length;
    return flips >= 3 || !/[aeiouyáéěíóúůýAEIOUY]/u.test(w);
  });
}

/** Bots love Gmail's "dots don't matter": h.l.ew.isj.ac.k@gmail.com. */
export function dottedGmail(email: string) {
  const [local, domain] = email.trim().toLowerCase().split("@");
  if (!local || !/^(gmail|googlemail)\.com$/.test(domain ?? "")) return false;
  return (local.match(/\./g) ?? []).length >= 3;
}

/** True when the submission looks automated. */
export function looksLikeBot(fd: FormData, now = Date.now()) {
  const trap = fd.get(HONEYPOT);
  if (typeof trap === "string" && trap.trim() !== "") return true;
  const stamp = fd.get(STAMP);
  if (typeof stamp !== "string" || !stampOk(stamp, now)) return true;
  const name = String(fd.get("name") ?? "");
  const email = String(fd.get("email") ?? "");
  return gibberishName(name) || dottedGmail(email);
}
