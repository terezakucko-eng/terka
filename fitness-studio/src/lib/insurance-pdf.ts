import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, setCharacterSpacing, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import sharp from "sharp";
import { formatDate } from "@/lib/dates";
import { formatPrice } from "@/lib/money";

/** Everything printed on the insurance confirmation (A4 PDF). */
export type ConfirmationDoc = {
  provider: { company: string; ico: string; address: string; city: string; email: string; phone: string; web: string };
  client: { name: string; birthDate: string | null };
  year: number;
  items: { date: Date; description: string; amount: number }[];
  total: number;
  /** "7KQ4-M2PX" */
  code: string;
  issuedAt: Date;
  /** Full URL of the check, encoded into the QR code. */
  verifyUrl: string;
};

const png = (width: number) => (svg: Buffer) => sharp(svg, { density: 600 }).resize({ width }).png().toBuffer();
const assets = () =>
  Promise.all([
    readFile(join(process.cwd(), "assets/fonts/DMSans-Regular.ttf")),
    readFile(join(process.cwd(), "assets/fonts/DMSans-SemiBold.ttf")),
    readFile(join(process.cwd(), "public/brand/symbol-green.svg")).then(png(360)),
    readFile(join(process.cwd(), "public/brand/wordmark-green.svg")).then(png(900)),
  ]);

const INK = rgb(0.106, 0.145, 0.086);
const MUTED = rgb(0.42, 0.435, 0.37);
const ACCENT = rgb(0.478, 0.353, 0.173);
const GOLD = rgb(0.757, 0.6, 0.4);
const RULE = rgb(0.86, 0.85, 0.82);

const W = 595.28;
const H = 841.89;
const M = 56;

// Intl puts narrow no-break spaces into numbers – print them as plain no-break spaces
const clean = (s: string) => s.replace(/ /g, " ");
const price = (h: number) => clean(formatPrice(h));
const czDate = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return `${d}. ${m}. ${y}`;
};

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** The confirmation as PDF bytes – one A4 page, more only for a very long list of payments. */
export async function confirmationPdf(doc: ConfirmationDoc) {
  const [regularBytes, boldBytes, symbolPng, wordmarkPng] = await assets();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Potvrzení pro zdravotní pojišťovnu ${doc.year} – ${doc.client.name}`);
  pdf.setAuthor(doc.provider.company);
  pdf.setCreator("OCTOPUSH");
  const regular = await pdf.embedFont(regularBytes);
  const bold = await pdf.embedFont(boldBytes);
  const symbol = await pdf.embedPng(symbolPng);
  const wordmark = await pdf.embedPng(wordmarkPng);
  const qr = await pdf.embedPng(await QRCode.toBuffer(doc.verifyUrl, { margin: 0, width: 300, errorCorrectionLevel: "M" }));

  let page = pdf.addPage([W, H]);
  let y = H - M;

  const text = (s: string, x: number, size: number, o: { font?: PDFFont; color?: ReturnType<typeof rgb>; p?: PDFPage } = {}) =>
    (o.p ?? page).drawText(clean(s), { x, y, size, font: o.font ?? regular, color: o.color ?? INK });
  /** right-aligned at xr; `spacing` = letter spacing the caller has switched on */
  const right = (s: string, xr: number, size: number, font = regular, color = INK, spacing = 0) =>
    text(s, xr - font.widthOfTextAtSize(clean(s), size) - spacing * clean(s).length, size, { font, color });
  const label = (s: string) => {
    page.pushOperators(setCharacterSpacing(1.4));
    text(s.toUpperCase(), M, 7.5, { font: bold, color: ACCENT });
    page.pushOperators(setCharacterSpacing(0));
  };
  const rule = (yy: number, color = RULE, thickness = 0.5) =>
    page.drawLine({ start: { x: M, y: yy }, end: { x: W - M, y: yy }, thickness, color });
  const image = (img: PDFImage, x: number, top: number, width: number) => {
    const h = (img.height / img.width) * width;
    page.drawImage(img, { x, y: top - h, width, height: h });
    return h;
  };

  // header: logo left, provider right
  const symH = image(symbol, M, y + 4, 40);
  image(wordmark, M + 50, y - symH / 2 + 6, 104);
  const web = doc.provider.web.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const firm = [doc.provider.company, `IČO ${doc.provider.ico}`, doc.provider.address, `${doc.provider.email} · ${doc.provider.phone}`, web];
  firm.forEach((l, i) => {
    y = H - M - i * 11.5;
    right(l, W - M, i === 0 ? 9 : 8, i === 0 ? bold : regular, i === 0 ? INK : MUTED);
  });
  y = H - M - 58;
  rule(y, GOLD, 1.2);

  y -= 34;
  text("Potvrzení o úhradě pohybových aktivit", M, 19, { font: bold });
  y -= 17;
  text(`pro účely příspěvku zdravotní pojišťovny za rok ${doc.year}`, M, 10, { color: MUTED });
  y -= 8;

  const KX = M + 120;
  const pair = (k: string, v: string, vFont = bold) => {
    const lines = wrap(clean(v), vFont, 10, W - M - KX);
    text(k, M, 10, { color: MUTED });
    lines.forEach((l, i) => {
      if (i) y -= 13;
      text(l, KX, 10, { font: vFont });
    });
    y -= 15;
  };
  const section = (title: string) => {
    y -= 10;
    label(title);
    y -= 16;
  };

  section("Poskytovatel");
  pair("Název", `${doc.provider.company} – fitness studio OCTOPUSH`);
  pair("IČO", doc.provider.ico);
  pair("Adresa", doc.provider.address);

  section("Klient");
  pair("Jméno a příjmení", doc.client.name);
  if (doc.client.birthDate) pair("Datum narození", czDate(doc.client.birthDate));
  else {
    text("Datum narození", M, 10, { color: MUTED });
    page.drawLine({ start: { x: KX, y: y - 2 }, end: { x: KX + 150, y: y - 2 }, thickness: 0.8, color: INK });
    y -= 15;
  }

  section("Aktivita");
  pair("Druh aktivity", "pohybové aktivity – skupinové cvičení pod vedením lektora");
  pair("Období", `kalendářní rok ${doc.year}`);

  section("Uhrazené platby");
  const DX = M;
  const PX = M + 92;
  const head = () => {
    page.pushOperators(setCharacterSpacing(0.8));
    text("DATUM ÚHRADY", DX, 7, { font: bold, color: MUTED });
    text("POLOŽKA", PX, 7, { font: bold, color: MUTED });
    right("ČÁSTKA", W - M, 7, bold, MUTED, 0.8);
    page.pushOperators(setCharacterSpacing(0));
    y -= 6;
    rule(y, RULE, 0.8);
    y -= 13;
  };
  head();
  for (const it of doc.items) {
    if (y < M + 40) {
      page = pdf.addPage([W, H]);
      y = H - M;
      head();
    }
    text(formatDate(it.date), DX, 9.5);
    const [first] = wrap(clean(it.description), regular, 9.5, W - M - 80 - PX);
    text(first, PX, 9.5);
    right(price(it.amount), W - M, 9.5, bold);
    y -= 4;
    rule(y);
    y -= 10.5;
  }
  y -= 2;
  rule(y + 10.5, INK, 1);
  y -= 3;
  text("Celkem uhrazeno", M, 11.5, { font: bold });
  right(price(doc.total), W - M, 11.5, bold);
  y -= 22;
  text("Potvrzujeme, že výše uvedené částky byly uhrazeny v plné výši.", M, 10);

  // verification + optional hand signature – kept together at the bottom of the last page
  const blockH = 124;
  if (y - 14 < M + blockH) {
    page = pdf.addPage([W, H]);
  }
  y = M + blockH;
  rule(y, GOLD, 0.8);
  const top = y - 16;
  page.drawImage(qr, { x: M, y: top - 78, width: 78, height: 78 });
  const TX = M + 94;
  y = top - 8;
  text("Elektronické ověření", TX, 10, { font: bold });
  const note = `Potvrzení bylo vystaveno elektronicky a je platné bez razítka a podpisu. Pravost ověříte načtením QR kódu nebo na ${web}/overeni zadáním kódu:`;
  for (const l of wrap(note, regular, 8.5, 230)) {
    y -= 12;
    text(l, TX, 8.5, { color: MUTED });
  }
  y -= 22;
  page.pushOperators(setCharacterSpacing(2));
  text(doc.code, TX, 16, { font: bold, color: ACCENT });
  page.pushOperators(setCharacterSpacing(0));

  const SX = W - M - 150;
  y = top - 8;
  text(`V ${doc.provider.city === "Ostrava" ? "Ostravě" : doc.provider.city} dne ${formatDate(doc.issuedAt)}`, SX, 9.5);
  page.drawLine({ start: { x: SX, y: top - 74 }, end: { x: W - M, y: top - 74 }, thickness: 0.8, color: INK });
  y = top - 86;
  text("razítko a podpis", SX, 7.5, { color: MUTED });
  y -= 10;
  text("(jen vyžaduje-li ho pojišťovna)", SX, 7.5, { color: MUTED });

  const pages = pdf.getPages();
  if (pages.length > 1)
    pages.forEach((p, i) => {
      y = M / 2;
      text(`Potvrzení ${doc.code} · ${doc.client.name} · strana ${i + 1} z ${pages.length}`, M, 7.5, { color: MUTED, p });
    });

  return pdf.save();
}
