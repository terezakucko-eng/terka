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
// at card size the screen logo's fine lines get lost in print – the outlines a little bolder
const bolderSymbol = (svg: Buffer) =>
  Buffer.from(svg.toString("utf8").replace('fill="url(#gold)"', 'fill="url(#gold)" stroke="url(#gold)" stroke-width="2.4" stroke-linejoin="round"'));
const bolderWordmark = (svg: Buffer) =>
  Buffer.from(
    svg
      .toString("utf8")
      .replace('<g fill="#D2A772" color="#D2A772">', '<g fill="#D2A772" color="#D2A772" stroke="#D2A772" stroke-width="1.4" stroke-linejoin="round">')
      .replace('stroke-width="3.6"', 'stroke-width="5.2"'),
  );
const assets = () =>
  Promise.all([
    readFile(join(process.cwd(), "assets/fonts/DMSans-Regular.ttf")),
    readFile(join(process.cwd(), "assets/fonts/DMSans-SemiBold.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Allura-Regular.ttf")),
    readFile(join(process.cwd(), "public/brand/symbol-gold.svg")).then(bolderSymbol).then(png(600)),
    readFile(join(process.cwd(), "public/brand/wordmark-gold.svg")).then(bolderWordmark).then(png(900)),
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

type Ctx = Awaited<ReturnType<typeof embedAssets>>;

async function embedAssets(pdf: PDFDocument) {
  const [regularBytes, boldBytes, scriptBytes, symbolPng, wordmarkPng] = await assets();
  pdf.registerFontkit(fontkit);
  pdf.setTitle("Pošli to dál – kartičky OCTOPUSH");
  pdf.setCreator("OCTOPUSH");
  return {
    regular: await pdf.embedFont(regularBytes),
    bold: await pdf.embedFont(boldBytes),
    script: await pdf.embedFont(scriptBytes),
    symbol: await pdf.embedPng(symbolPng),
    wordmark: await pdf.embedPng(wordmarkPng),
  };
}

/** The gold frame inside the card whose trim box starts at (ox, oy). */
const frame = (page: PDFPage, ox: number, oy: number) =>
  page.drawRectangle({ x: ox + 6, y: oy + 6, width: TW - 12, height: TH - 12, borderColor: GOLD, borderWidth: 0.6 });

/** Front (forest, the gold octopus, „Pošli to dál“) on the trim box at (ox, oy) – the background is drawn by the caller. */
function drawFront(page: PDFPage, ox: number, oy: number, { bold, script, symbol, wordmark }: Ctx) {
  frame(page, ox, oy);
  // the logo, bigger: the octopus above the wordmark, together centred on the card's height
  const symW = 72;
  const symH = (symbol.height / symbol.width) * symW;
  const wmW = 80;
  const wmH = (wordmark.height / wordmark.width) * wmW;
  const centre = ox + 14 + wmW / 2;
  const symY = oy + TH / 2 + (symH + 6 + wmH) / 2 - symH;
  page.drawImage(symbol, { x: centre - symW / 2, y: symY, width: symW, height: symH });
  page.drawImage(wordmark, { x: centre - wmW / 2, y: symY - 6 - wmH, width: wmW, height: wmH });

  const x = ox + 104;
  const room = ox + TW - 12 - x;
  const title = "Pošli to dál";
  // the script's last stroke swings past its width – keep clear of the frame
  const titleSize = Math.min(34, (34 * (room - 8)) / script.widthOfTextAtSize(title, 34));
  page.drawText(title, { x, y: oy + TH / 2 + 14, size: titleSize, font: script, color: GOLD });
  // the offer on two lines, so it can be big
  const offer = ["LEKCE ZDARMA", "PRO DVĚ OSOBY"];
  const offerSize = Math.min(11, ...offer.map((l) => (11 * room) / spacedWidth(l, bold, 11, 1)));
  offer.forEach((l, i) => spaced(page, l, { x, y: oy + TH / 2 - 4 - i * (offerSize + 3), size: offerSize, font: bold, color: CREAM, spacing: offerSize / 11 }));
  let y = oy + TH / 2 - 4 - 2 * (offerSize + 3) - 6;
  for (const l of wrap(clean("Díky, že pomáháš rozhýbat svět – jednoho člověka po druhém."), bold, 7.5, room)) {
    page.drawText(l, { x, y, size: 7.5, font: bold, color: GOLD_LIGHT });
    y -= 9.5;
  }
}

/** Back (cream, how it works, the QR code) on the trim box at (ox, oy) – the background is drawn by the caller. */
async function drawBack(pdf: PDFDocument, page: PDFPage, ox: number, oy: number, card: PassCardDoc, footer: string, { regular, bold }: Ctx) {
  frame(page, ox, oy);
  const qrSize = 80;
  const qrX = ox + TW - 14 - qrSize;
  const qrY = oy + TH / 2 - qrSize / 2 + 6;
  const qr = await pdf.embedPng(
    await QRCode.toBuffer(card.url, { margin: 0, width: 400, errorCorrectionLevel: "M", color: { dark: "#1b2516", light: "#00000000" } }),
  );
  page.drawImage(qr, { x: qrX, y: qrY, width: qrSize, height: qrSize });
  const tag = `${card.label.toUpperCase()} · ${card.code}`;
  const tagSize = 5.5;
  spaced(page, clean(tag), {
    x: qrX + (qrSize - spacedWidth(tag, bold, tagSize, 0.8)) / 2,
    y: qrY - 10,
    size: tagSize,
    font: bold,
    color: MUTED,
    spacing: 0.8,
  });

  const lx = ox + 16;
  const lw = qrX - lx - 10;
  spaced(page, "JAK NA TO", { x: lx, y: oy + TH - 24, size: 6.5, font: bold, color: GOLD, spacing: 1.4 });
  const steps = ["Naskenuj QR kód a zaregistruj se.", "Kartička má 2 místa – udělej někomu radost a vezmi ho s sebou.", "Lekci si rezervuješ online, web tě povede.", "Po rezervaci můžeš kartičku hned poslat dál."];
  let y = oy + TH - 34.5;
  steps.forEach((s, i) => {
    page.drawText(`${i + 1}`, { x: lx, y, size: 7, font: bold, color: GOLD });
    for (const l of wrap(clean(s), i === 3 ? bold : regular, 7, lw - 9)) {
      page.drawText(l, { x: lx + 9, y, size: 7, font: i === 3 ? bold : regular, color: INK });
      y -= 7.9;
    }
    y -= 1.2;
  });
  // the rules, right above the address
  const rules = wrap(clean("Jen pro nováčky – každý jeden vstup zdarma. Využij ho do 14 dní od registrace. Nepoužitá kartička po měsíci propadne."), regular, 6, lw);
  rules.forEach((l, i) => page.drawText(l, { x: lx, y: oy + 33 + 7.4 * (rules.length - 1 - i), size: 6, font: regular, color: MUTED }));
  const web = card.url.replace(/^https?:\/\/(www\.)?/, "");
  page.drawText(web, { x: lx, y: oy + 22, size: 6, font: bold, color: INK });
  page.drawText(clean(footer), { x: lx, y: oy + 13, size: 5.2, font: regular, color: MUTED });
}

/** All the cards in one PDF for the print shop – front and back of each, in order, card size with bleed. */
export async function passCardsPdf(cards: PassCardDoc[], footer: string) {
  const pdf = await PDFDocument.create();
  const ctx = await embedAssets(pdf);
  for (const card of cards) {
    const front = pdf.addPage([W, H]);
    front.drawRectangle({ x: 0, y: 0, width: W, height: H, color: FOREST });
    drawFront(front, BLEED, BLEED, ctx);
    const back = pdf.addPage([W, H]);
    back.drawRectangle({ x: 0, y: 0, width: W, height: H, color: CREAM });
    await drawBack(pdf, back, BLEED, BLEED, card, footer, ctx);
  }
  return pdf.save();
}

// A4 sheets to print at home or in the office: 2 × 5 cards side by side (one cut between neighbours), fronts on one page,
// backs on the next mirrored left–right – duplex flipped on the long edge puts each back right behind its front
const A4W = 210 * MM;
const A4H = 297 * MM;
const COLS = 2;
const ROWS = 5;
export const CARDS_PER_SHEET = COLS * ROWS;

/**
 * The cards on A4 for duplex printing: per sheet a page of fronts and a page of backs, with cut marks.
 * Print at 100 % (actual size), both sides, flipped on the long edge.
 */
export async function passCardsSheetPdf(cards: PassCardDoc[], footer: string) {
  const pdf = await PDFDocument.create();
  const ctx = await embedAssets(pdf);
  const left = (A4W - COLS * TW) / 2;
  const bottom = (A4H - ROWS * TH) / 2;
  // trim box of the slot, front side: row 0 at the top
  const slot = (i: number, mirrored: boolean) => {
    const col = i % COLS;
    return { x: left + (mirrored ? COLS - 1 - col : col) * TW, y: bottom + (ROWS - 1 - Math.floor(i / COLS)) * TH };
  };
  const marks = (page: PDFPage) => {
    // short enough to stay inside what an office printer prints (≈ 5 mm from the edge)
    const len = 4 * MM;
    const gap = BLEED + 1 * MM;
    const ink = { thickness: 0.4, color: rgb(0.3, 0.3, 0.3) };
    for (let c = 0; c <= COLS; c++) {
      const x = left + c * TW;
      page.drawLine({ start: { x, y: bottom - gap }, end: { x, y: bottom - gap - len }, ...ink });
      page.drawLine({ start: { x, y: bottom + ROWS * TH + gap }, end: { x, y: bottom + ROWS * TH + gap + len }, ...ink });
    }
    for (let r = 0; r <= ROWS; r++) {
      const y = bottom + r * TH;
      page.drawLine({ start: { x: left - gap, y }, end: { x: left - gap - len, y }, ...ink });
      page.drawLine({ start: { x: left + COLS * TW + gap, y }, end: { x: left + COLS * TW + gap + len, y }, ...ink });
    }
  };
  for (let from = 0; from < cards.length; from += CARDS_PER_SHEET) {
    const sheet = cards.slice(from, from + CARDS_PER_SHEET);
    const front = pdf.addPage([A4W, A4H]);
    const back = pdf.addPage([A4W, A4H]);
    // backgrounds first (with bleed into the neighbours – the same colour), then the cards on top
    sheet.forEach((_, i) => {
      for (const [page, mirrored, color] of [[front, false, FOREST], [back, true, CREAM]] as const) {
        const s = slot(i, mirrored);
        page.drawRectangle({ x: s.x - BLEED, y: s.y - BLEED, width: W, height: H, color });
      }
    });
    for (const [i, card] of sheet.entries()) {
      const f = slot(i, false);
      drawFront(front, f.x, f.y, ctx);
      const b = slot(i, true);
      await drawBack(pdf, back, b.x, b.y, card, footer, ctx);
    }
    marks(front);
    marks(back);
  }
  return pdf.save();
}
