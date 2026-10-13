import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, setCharacterSpacing, type PDFFont } from "pdf-lib";
import QRCode from "qrcode";
import sharp from "sharp";
import { formatDate } from "@/lib/dates";
import { nbsp } from "@/lib/typography";

/** Everything printed on a gift voucher (A5 landscape PDF). */
export type VoucherDoc = {
  /** „Permanentka 10 vstupů“, „Poukaz na 1 000 Kč“ */
  title: string;
  /** Second line under the title (e.g. how much credit), optional */
  detail?: string | null;
  recipientName?: string | null;
  message?: string | null;
  /** "7KQ4-M2PX" */
  code: string;
  validUntil: Date | null;
  /** Full URL where the voucher is redeemed, encoded into the QR code. */
  redeemUrl: string;
  provider: { company: string; address: string; web: string; email: string; phone: string };
};

const png = (width: number) => (svg: Buffer) => sharp(svg, { density: 600 }).resize({ width }).png().toBuffer();
const assets = () =>
  Promise.all([
    readFile(join(process.cwd(), "assets/fonts/DMSans-Regular.ttf")),
    readFile(join(process.cwd(), "assets/fonts/DMSans-SemiBold.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Allura-Regular.ttf")),
    readFile(join(process.cwd(), "public/brand/symbol-gold.svg")).then(png(700)),
    readFile(join(process.cwd(), "public/brand/wordmark-gold.svg")).then(png(900)),
  ]);

const FOREST = rgb(0.106, 0.145, 0.086);
const CREAM = rgb(0.965, 0.937, 0.89);
const INK = rgb(0.106, 0.145, 0.086);
const MUTED = rgb(0.42, 0.435, 0.37);
const GOLD = rgb(0.757, 0.6, 0.4);
const GOLD_LIGHT = rgb(0.91, 0.78, 0.6);

// A5 landscape
const W = 595.28;
const H = 419.53;
const PANEL = 200;

// Intl puts narrow no-break spaces into numbers – print them as plain no-break spaces;
// no line ends with „k“ or „na“ (Czech typography)
const clean = (s: string) => nbsp(s.replace(/\u202f/g, "\u00a0"));

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  let line = "";
  // only ordinary spaces break a line
  for (const word of text.split(/ +/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export async function voucherPdf(doc: VoucherDoc) {
  const [regularBytes, boldBytes, scriptBytes, symbolPng, wordmarkPng] = await assets();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Dárkový poukaz OCTOPUSH – ${doc.title}`);
  pdf.setAuthor(doc.provider.company);
  pdf.setCreator("OCTOPUSH");
  const regular = await pdf.embedFont(regularBytes);
  const bold = await pdf.embedFont(boldBytes);
  const script = await pdf.embedFont(scriptBytes);
  const symbol = await pdf.embedPng(symbolPng);
  const wordmark = await pdf.embedPng(wordmarkPng);
  const qr = await pdf.embedPng(
    await QRCode.toBuffer(doc.redeemUrl, { margin: 0, width: 300, errorCorrectionLevel: "M", color: { dark: "#1b2516", light: "#00000000" } }),
  );
  const page = pdf.addPage([W, H]);

  // background: cream card, forest panel on the left with the gold octopus
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: CREAM });
  page.drawRectangle({ x: 0, y: 0, width: PANEL, height: H, color: FOREST });
  page.drawRectangle({ x: 14, y: 14, width: W - 28, height: H - 28, borderColor: GOLD, borderWidth: 0.8 });
  const symW = 128;
  const symH = (symbol.height / symbol.width) * symW;
  page.drawImage(symbol, { x: (PANEL - symW) / 2, y: H / 2 - symH / 2 + 34, width: symW, height: symH });
  const wmW = 132;
  const wmH = (wordmark.height / wordmark.width) * wmW;
  page.drawImage(wordmark, { x: (PANEL - wmW) / 2, y: H / 2 - symH / 2 + 4 - wmH, width: wmW, height: wmH });
  const tag = "KAŽDÝ MÁ SVOU CESTU";
  page.pushOperators(setCharacterSpacing(1.6));
  page.drawText(tag, { x: (PANEL - bold.widthOfTextAtSize(tag, 6.5) - 1.6 * tag.length) / 2, y: 46, size: 6.5, font: bold, color: GOLD_LIGHT });
  page.pushOperators(setCharacterSpacing(0));

  // right side
  const X = PANEL + 34;
  const R = W - 40;
  const width = R - X;
  let y = H - 78;
  page.drawText("Dárkový poukaz", { x: X, y, size: 46, font: script, color: GOLD });
  y -= 40;
  for (const l of wrap(clean(doc.title), bold, 20, width)) {
    page.drawText(l, { x: X, y, size: 20, font: bold, color: INK });
    y -= 24;
  }
  if (doc.detail) {
    page.drawText(clean(doc.detail), { x: X, y: y + 4, size: 10, font: regular, color: MUTED });
    y -= 14;
  }
  if (doc.recipientName) {
    y -= 8;
    page.drawText(clean(`Pro: ${doc.recipientName}`), { x: X, y, size: 12, font: bold, color: INK });
    y -= 16;
  }
  if (doc.message) {
    y -= 2;
    for (const l of wrap(clean(`„${doc.message}“`), regular, 10.5, width).slice(0, 4)) {
      page.drawText(l, { x: X, y, size: 10.5, font: regular, color: INK });
      y -= 14;
    }
  }

  // code + QR at the bottom
  const qrSize = 74;
  const bottom = 46;
  page.drawImage(qr, { x: R - qrSize, y: bottom, width: qrSize, height: qrSize });
  page.pushOperators(setCharacterSpacing(1.4));
  page.drawText("KÓD POUKAZU", { x: X, y: bottom + 58, size: 7, font: bold, color: GOLD });
  page.pushOperators(setCharacterSpacing(3));
  page.drawText(doc.code, { x: X, y: bottom + 34, size: 22, font: bold, color: INK });
  page.pushOperators(setCharacterSpacing(0));
  const valid = doc.validUntil ? `Platí do ${formatDate(doc.validUntil)}` : "Platí po zaplacení";
  page.drawText(clean(valid), { x: X, y: bottom + 18, size: 9, font: bold, color: INK });
  const web = doc.provider.web.replace(/^https?:\/\//, "").replace(/\/$/, "");
  page.drawText(clean(`Uplatníš na ${web}/poukaz nebo v Můj účet.`), { x: X, y: bottom + 5, size: 8, font: regular, color: MUTED });
  const foot = [doc.provider.company, doc.provider.address, doc.provider.phone].filter(Boolean).join(" · ");
  page.drawText(clean(foot), { x: X, y: 26, size: 6.5, font: regular, color: MUTED });

  return pdf.save();
}
