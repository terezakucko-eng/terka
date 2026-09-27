import QRCode from "qrcode";

/**
 * "19-2000145399/0800" or "2000145399/0800" → "CZ65 0800 0000 1920 0014 5399"-style IBAN
 * (compact). Returns null when the input is not a Czech account number.
 * Already-IBAN input ("CZ…") is returned normalised.
 */
export function czIban(account: string): string | null {
  const a = account.replace(/\s/g, "").toUpperCase();
  if (/^CZ\d{22}$/.test(a)) return a;
  const m = /^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/.exec(a);
  if (!m) return null;
  const bban = m[3] + (m[1] ?? "").padStart(6, "0") + m[2].padStart(10, "0");
  // CZ = 12 35, checksum placeholder 00
  const check = 98 - mod97(`${bban}123500`);
  return `CZ${String(check).padStart(2, "0")}${bban}`;
}

function mod97(digits: string) {
  let r = 0;
  for (const ch of digits) r = (r * 10 + Number(ch)) % 97;
  return r;
}

/** Czech "QR Platba" (Short Payment Descriptor) text. */
export function spdPayload(opts: { iban: string; amountHalere: number; vs: number | string; message?: string }) {
  const msg = (opts.message ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[*]/g, " ")
    .slice(0, 60);
  return [
    "SPD*1.0",
    `ACC:${opts.iban}`,
    `AM:${(opts.amountHalere / 100).toFixed(2)}`,
    "CC:CZK",
    `X-VS:${opts.vs}`,
    msg && `MSG:${msg}`,
  ]
    .filter(Boolean)
    .join("*");
}

export function qrSvg(text: string) {
  return QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1a281b", light: "#ffffff" } });
}
