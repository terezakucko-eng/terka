/**
 * Normalises a phone number to E.164 (+420777123456).
 * 9-digit numbers are treated as Czech; returns null if it can't be a phone.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.replace(/[\s\-().\/]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (/^\d{9}$/.test(s)) s = `+420${s}`;
  if (/^(420|421)\d{9}$/.test(s)) s = `+${s}`;
  return /^\+\d{8,15}$/.test(s) ? s : null;
}

/** "+420777123456" → "+420 777 123 456" */
export function formatPhone(e164: string) {
  const m = /^\+(420|421)(\d{3})(\d{3})(\d{3})$/.exec(e164);
  return m ? `+${m[1]} ${m[2]} ${m[3]} ${m[4]}` : e164;
}
