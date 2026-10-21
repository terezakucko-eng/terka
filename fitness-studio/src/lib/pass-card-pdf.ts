import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, setCharacterSpacing, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import sharp from "sharp";
import { nbsp } from "@/lib/typography";

/** One plastic Pošli to dál card: front with the octopus, back with the QR code. */
export type PassCardDoc = { label: string; code: string; url: string };

const png = (width: number) => (svg: Buffer) => sharp(svg, { density: 600 }).resize({ width }).png().toBuffer();
const assets = () =>
  Promise.all([
    readFile(join(process.cwd(), "assets/fonts/DMSans-Regular.ttf")),
    readFile(join(process.cwd(), "assets/fonts/DMSans-SemiBold.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Allura-Regular.ttf")),
    readFile(join(process.cwd(), "public/brand/symbol-gold.svg")).then(png(500)),
    readFile(join(process.cwd(), "public/brand/wordmark-gold.svg")).then(png(700)),
  ]);

const FOREST = rgb(0.106, 0.145, 0.086);
const CREAM = rgb(0.965, 0.937, 0.89);
const INK = rgb(0.106, 0.145, 0.086);
const MUTED = rgb(0.42, 0.435, 0.37);
const GOLD = rgb(0.757, 0.6, 0.4);
const GOLD_LIGHT = rgb(0.91, 0.78, 0.6);

// a plastic card the size of a payment card (CR80, 85.6 × 54 mm) with 3 mm bleed on every side for the print shop
const MM = 72 / 25.4;
const BLEED = 3 * MM;
const TW = 85.6 * MM;
const TH = 54 * MM;
const W = TW + 2 * BLEED;
const H = TH + 2 * BLEED;

const clean = (s: string) => nbsp(s.replace(/ /g, " "));

function spaced(page: PDFPage, text: string, o: { x: number; y: number; size: number; font: PDFFont; color: ReturnType<typeof rgb>; spacing: number }) {
  page.pushOperators(setCharacterSpacing(o.spacing));
  page.drawText(text, o);
  page.pushOperators(setCharacterSpacing(0));
}
const spacedWidth = (text: string, font: PDFFont, size: number, spacing: number) => font.widthOfTextAtSize(text, size) + spacing * text.length;

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  let line = "";
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

/** All the cards in one PDF – front and back of each, in order. */
export async function passCardsPdf(cards: PassCardDoc[], footer: string) {
  const [regularBytes, boldBytes, scriptBytes, symbolPng, wordmarkPng] = await assets();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle("Pošli to dál – kartičky OCTOPUSH");
  pdf.setCreator("OCTOPUSH");
  const regular = await pdf.embedFont(regularBytes);
  const bold = await pdf.embedFont(boldBytes);
  const script = await pdf.embedFont(scriptBytes);
  const symbol = await pdf.embedPng(symbolPng);
  const wordmark = await pdf.embedPng(wordmarkPng);
  const frame = (page: PDFPage) =>
    page.drawRectangle({ x: BLEED + 6, y: BLEED + 6, width: TW - 12, height: TH - 12, borderColor: GOLD, borderWidth: 0.6 });

  for (const card of cards) {
    // front: forest, the gold octopus, „Pošli to dál“
    const front = pdf.addPage([W, H]);
    front.drawRectangle({ x: 0, y: 0, width: W, height: H, color: FOREST });
    frame(front);
    const symW = 62;
    const symH = (symbol.height / symbol.width) * symW;
    const symX = BLEED + 18;
    const symY = H / 2 - symH / 2 + 9;
    front.drawImage(symbol, { x: symX, y: symY, width: symW, height: symH });
    const wmW = 58;
    const wmH = (wordmark.height / wordmark.width) * wmW;
    front.drawImage(wordmark, { x: symX + (symW - wmW) / 2, y: symY - wmH - 5, width: wmW, height: wmH });

    const x = BLEED + 98;
    const room = BLEED + TW - 14 - x;
    const title = "Pošli to dál";
    const titleSize = Math.min(32, (32 * room) / script.widthOfTextAtSize(title, 32));
    front.drawText(title, { x, y: H / 2 + 10, size: titleSize, font: script, color: GOLD });
    const offer = "LEKCE PRO DVA ZDARMA";
    const offerSize = Math.min(9.5, (9.5 * room) / spacedWidth(offer, bold, 9.5, 1));
    spaced(front, offer, { x, y: H / 2 - 8, size: offerSize, font: bold, color: CREAM, spacing: (1 * offerSize) / 9.5 });
    let y = H / 2 - 21;
    for (const l of wrap(clean("Díky, že pomáháš rozhýbat svět – jednoho člověka po druhém."), regular, 7, room)) {
      front.drawText(l, { x, y, size: 7, font: regular, color: GOLD_LIGHT });
      y -= 9;
    }

    // back: cream, how it works, the QR code
    const back = pdf.addPage([W, H]);
    back.drawRectangle({ x: 0, y: 0, width: W, height: H, color: CREAM });
    frame(back);
    const qrSize = 80;
    const qrX = BLEED + TW - 14 - qrSize;
    const qrY = H / 2 - qrSize / 2 + 6;
    const qr = await pdf.embedPng(
      await QRCode.toBuffer(card.url, { margin: 0, width: 400, errorCorrectionLevel: "M", color: { dark: "#1b2516", light: "#00000000" } }),
    );
    back.drawImage(qr, { x: qrX, y: qrY, width: qrSize, height: qrSize });
    const tag = `${card.label.toUpperCase()} · ${card.code}`;
    const tagSize = 5.5;
    spaced(back, clean(tag), {
      x: qrX + (qrSize - spacedWidth(tag, bold, tagSize, 0.8)) / 2,
      y: qrY - 10,
      size: tagSize,
      font: bold,
      color: MUTED,
      spacing: 0.8,
    });

    const lx = BLEED + 16;
    const lw = qrX - lx - 10;
    spaced(back, "JAK NA TO", { x: lx, y: BLEED + TH - 24, size: 6.5, font: bold, color: GOLD, spacing: 1.4 });
    const steps = ["Naskenuj QR kód a zaregistruj se.", "Kartička má 2 místa – udělej někomu radost a vezmi ho s sebou.", "Lekci si rezervuješ online, web tě povede.", "Po rezervaci můžeš kartičku hned poslat dál."];
    y = BLEED + TH - 36;
    steps.forEach((s, i) => {
      back.drawText(`${i + 1}`, { x: lx, y, size: 7, font: bold, color: GOLD });
      for (const l of wrap(clean(s), i === 3 ? bold : regular, 7, lw - 9)) {
        back.drawText(l, { x: lx + 9, y, size: 7, font: i === 3 ? bold : regular, color: INK });
        y -= 8.4;
      }
      y -= 1.8;
    });
    // the rules, right above the address
    const rules = wrap(clean("Jen pro nové klienty, každý jednou. Kartička platí měsíc, lekce 14 dní."), regular, 6, lw);
    rules.forEach((l, i) => back.drawText(l, { x: lx, y: BLEED + 33 + 7.4 * (rules.length - 1 - i), size: 6, font: regular, color: MUTED }));
    const web = card.url.replace(/^https?:\/\/(www\.)?/, "");
    back.drawText(web, { x: lx, y: BLEED + 22, size: 6, font: bold, color: INK });
    back.drawText(clean(footer), { x: lx, y: BLEED + 13, size: 5.2, font: regular, color: MUTED });
  }
  return pdf.save();
}
