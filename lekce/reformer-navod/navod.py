#!/usr/bin/env python3
"""Návod k lekci na reformeru – A4 PDF se snímky poloh. Lekce je popsaná v souboru .json vedle skriptu.

Odkud vzít snímky (stačí jedno):
  --video SOUBOR.mp4   ostré snímky přímo z videa (ffmpeg) v časech ze souboru lekce
  --snimky SLOZKA      ilustrace, vlastní fotky nebo screenshoty: 01-vychozi.png, 01-provedeni.png, …
  --nahled SLOZKA      koncept z náhledových mozaik YouTube (M0.jpg … M13.jpg, 160×90 px)
Bez zdroje se místo snímků kreslí prázdné rámečky s časem ve videu.

  python3 navod.py zacatecnici-1.json --snimky ilustrace/
  python3 navod.py strength-55.json --video reformer-strength.mp4 --obrazky hotove-obrazky/
"""
import argparse
import io
import json
import math
import re
import subprocess
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Flowable, Frame, KeepTogether, NextPageTemplate, PageBreak,
                                PageTemplate, Paragraph, Spacer, Table, TableStyle)

HERE = Path(__file__).resolve().parent
FONT_DIR = Path('/usr/share/fonts/truetype/dejavu')
pdfmetrics.registerFont(TTFont('DejaVu', str(FONT_DIR / 'DejaVuSans.ttf')))
pdfmetrics.registerFont(TTFont('DejaVu-Bold', str(FONT_DIR / 'DejaVuSans-Bold.ttf')))
pdfmetrics.registerFontFamily('DejaVu', normal='DejaVu', bold='DejaVu-Bold', italic='DejaVu', boldItalic='DejaVu-Bold')

RED = colors.HexColor('#C62828')
INK = colors.HexColor('#222222')
GREY = colors.HexColor('#666666')
LIGHT = colors.HexColor('#E6E1DA')
PAPER = colors.HexColor('#FAF7F2')
ARROW_RGB = (214, 34, 34)

PAGE_W, PAGE_H = A4
MARGIN = 12 * mm
TOP = 17 * mm       # záhlaví stránek se cviky
BOTTOM = 13 * mm    # patička se zdrojem
ROWS_PER_PAGE = 3
GAP = 5 * mm        # mezera mezi dvěma snímky


# ---------- čeština ----------

NBSP = ' '


def cz(text):
    """Nezlomitelné mezery po jednopísmenných předložkách a spojkách a mezi číslem a jednotkou."""
    text = re.sub(r'(?<!\w)([kKsSvVzZaAiIoOuU]) +', r'\1' + NBSP, text)
    text = re.sub(r'(\d) +(?=(kg|lb|min|s\b|×|pružin|pulz|kol|cm))', r'\1' + NBSP, text)
    text = re.sub(r'(\d) × (\d)', r'\1' + NBSP + '×' + NBSP + r'\2', text)
    return text


def para(text, style):
    return Paragraph(escape(cz(text)), style)


def sekundy(cas):
    m, s = cas.split(':')
    return int(m) * 60 + int(s)


# ---------- snímky ----------

class Snimky:
    """Vrací PIL snímek pro (cvik, 'vychozi'|'provedeni') a jestli jde o záběr z videa."""

    def __init__(self, args, data):
        self.args = args
        self.krok = data['video']['nahled_krok_s']
        self.cache = Path(args.cache)
        self.mozaiky = {}

    def __call__(self, cvik, poloha):
        a = self.args
        t = cvik[poloha]
        if a.snimky:
            for ext in ('jpg', 'jpeg', 'png', 'webp'):
                p = Path(a.snimky) / f"{cvik['c']:02d}-{poloha}.{ext}"
                if p.exists():
                    return Image.open(p).convert('RGB'), False
            return None, False
        if a.video:
            self.cache.mkdir(parents=True, exist_ok=True)
            out = self.cache / f"{cvik['c']:02d}-{poloha}-{t.replace(':', '-')}.jpg"
            if not out.exists():
                subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', str(sekundy(t) + a.posun),
                                '-i', a.video, '-frames:v', '1', '-q:v', '2', str(out)], check=True)
            return Image.open(out).convert('RGB'), True
        if a.nahled:
            i = round(sekundy(t) / self.krok)
            list_, pos = divmod(i, 25)
            if list_ not in self.mozaiky:
                self.mozaiky[list_] = Image.open(Path(a.nahled) / f'M{list_}.jpg').convert('RGB')
            r, c = divmod(pos, 5)
            return self.mozaiky[list_].crop((c * 160, r * 90, c * 160 + 160, r * 90 + 90)), True
        return None, False


def vyrez(img, cvik, pomer, ze_videa):
    """Ořízne snímek na poměr stran rámečku. U záběrů z videa podle 'vyrez' [cx, cy, výška]."""
    W, H = img.size
    if ze_videa:
        cx, cy, h = cvik.get('vyrez', [0.5, 0.5, 1.0])
        hh = h * H
        ww = hh * pomer
        if ww > W:
            ww, hh = W, W / pomer
    else:
        cx, cy = 0.5, 0.5
        ww, hh = (W, W / pomer) if W / H < pomer else (H * pomer, H)
    x0 = min(max(cx * W - ww / 2, 0), W - ww)
    y0 = min(max(cy * H - hh / 2, 0), H - hh)
    box = (x0, y0, x0 + ww, y0 + hh)
    return img.crop(tuple(round(v) for v in box)), box


def nakresli_sipky(img, sipky, box, src_size):
    """Červené šipky směru pohybu. Souřadnice jsou v podílech celého zdrojového snímku:
    [[x1, y1], [x2, y2]] rovně, nebo [[x1, y1], [kx, ky], [x2, y2]] obloukem přes řídicí bod."""
    if not sipky:
        return img
    S = 3  # kreslí se ve větším měřítku kvůli vyhlazení
    W, H = img.size
    over = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    sw, sh = src_size
    x0, y0, x1, y1 = box

    def p(pt):
        return ((pt[0] * sw - x0) / (x1 - x0) * W * S, (pt[1] * sh - y0) / (y1 - y0) * H * S)

    width = max(4, round(W * S * 0.013))
    head = width * 3.2
    for s in sipky:
        pts = [p(q) for q in s]
        if len(pts) == 3:
            (ax, ay), (kx, ky), (bx, by) = pts
            line = [((1 - u) ** 2 * ax + 2 * (1 - u) * u * kx + u * u * bx,
                     (1 - u) ** 2 * ay + 2 * (1 - u) * u * ky + u * u * by) for u in [i / 40 for i in range(41)]]
        else:
            line = pts
        (px, py), (ex, ey) = line[-2], line[-1]
        ang = math.atan2(ey - py, ex - px)
        # čára končí u kořene hrotu, ať hrot zůstane ostrý
        bx, by = ex - head * 0.8 * math.cos(ang), ey - head * 0.8 * math.sin(ang)
        line = line[:-1] + [(bx, by)]
        for w, col in ((width + 2 * S, (255, 255, 255, 230)), (width, ARROW_RGB + (255,))):
            d.line(line, fill=col, width=w, joint='curve')
        tip = [(ex, ey),
               (ex - head * math.cos(ang - 0.45), ey - head * math.sin(ang - 0.45)),
               (ex - head * math.cos(ang + 0.45), ey - head * math.sin(ang + 0.45))]
        d.polygon(tip, fill=ARROW_RGB + (255,), outline=(255, 255, 255, 230))
    over = over.resize((W, H), Image.LANCZOS)
    out = img.convert('RGBA')
    out.alpha_composite(over)
    return out.convert('RGB')


def nakresli_schema(img, druh):
    """Malé schéma v rohu pro pohyb mimo rovinu bokorysu: kroužení nebo roznožení nohou, pohled od nohou."""
    if druh not in ('kruh', 'roznozeni'):
        return img
    W, H = img.size
    S = 3
    s = round(H * 0.42)
    over = Image.new('RGBA', (s * S, s * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    d.rounded_rectangle((0, 0, s * S - 1, s * S - 1), radius=s * S // 10, fill=(255, 255, 255, 235),
                        outline=(120, 120, 120, 255), width=S)
    cx, cy, r = s * S / 2, s * S * 0.47, s * S * 0.27
    w = max(3 * S, round(s * S * 0.035))
    hd = w * 3
    if druh == 'kruh':
        # kruh: nahoru → roznožit → dolů → spojit
        d.arc((cx - r, cy - r, cx + r, cy + r), start=-80, end=250, fill=ARROW_RGB + (255,), width=w)
        ang = math.radians(250)
        ex, ey = cx + r * math.cos(ang), cy + r * math.sin(ang)
        tang = ang + math.pi / 2
        d.polygon([(ex + hd * math.cos(tang), ey + hd * math.sin(tang)),
                   (ex + hd * 0.6 * math.cos(tang + 2.2), ey + hd * 0.6 * math.sin(tang + 2.2)),
                   (ex + hd * 0.6 * math.cos(tang - 2.2), ey + hd * 0.6 * math.sin(tang - 2.2))],
                  fill=ARROW_RGB + (255,))
    else:
        # roznožení: dvě nohy ve tvaru V, šipky od sebe a zpět k sobě
        leg = (70, 70, 70, 255)
        base = (cx, cy + r)
        for sx in (-1, 1):
            d.line([base, (cx + sx * r * 0.75, cy - r)], fill=leg, width=w)
            a0, a1 = (cx + sx * r * 0.25, cy - r * 0.55), (cx + sx * r * 1.05, cy - r * 0.55)
            d.line([a0, a1], fill=ARROW_RGB + (255,), width=w)
            d.polygon([(a1[0] + sx * hd * 0.6, a1[1]), (a1[0] - sx * hd * 0.4, a1[1] - hd * 0.6),
                       (a1[0] - sx * hd * 0.4, a1[1] + hd * 0.6)], fill=ARROW_RGB + (255,))
    f = ImageFont.truetype(str(FONT_DIR / 'DejaVuSans-Bold.ttf'), round(s * S * 0.1))
    d.text((cx, s * S * 0.9), 'pohled od nohou', fill=(60, 60, 60, 255), font=f, anchor='mm')
    over = over.resize((s, s), Image.LANCZOS)
    out = img.convert('RGBA')
    m = round(H * 0.03)
    out.alpha_composite(over, (W - s - m, m))
    return out.convert('RGB')


def priprav(img, cvik, poloha, pomer, ze_videa, px_w):
    src_size = img.size
    img, box = vyrez(img, cvik, pomer, ze_videa)
    img = img.resize((px_w, round(px_w / pomer)), Image.LANCZOS if img.width > px_w else Image.BICUBIC)
    if poloha == 'provedeni':
        img = nakresli_sipky(img, cvik.get('sipky' if ze_videa else 'sipky_snimky'), box, src_size)
        img = nakresli_schema(img, cvik.get('schema'))
    return img


# ---------- PDF ----------

ST = {
    'h1': ParagraphStyle('h1', fontName='DejaVu-Bold', fontSize=20, leading=24, textColor=INK),
    'sub': ParagraphStyle('sub', fontName='DejaVu', fontSize=9.5, leading=13, textColor=GREY),
    'h2': ParagraphStyle('h2', fontName='DejaVu-Bold', fontSize=10.5, leading=13, textColor=INK, spaceBefore=6),
    'txt': ParagraphStyle('txt', fontName='DejaVu', fontSize=8.5, leading=11, textColor=INK),
    'td': ParagraphStyle('td', fontName='DejaVu', fontSize=7.6, leading=9.6, textColor=INK),
    'tdb': ParagraphStyle('tdb', fontName='DejaVu-Bold', fontSize=7.6, leading=9.6, textColor=INK),
    'tdn': ParagraphStyle('tdn', fontName='DejaVu', fontSize=7.6, leading=9.6, textColor=RED),
    'blk': ParagraphStyle('blk', fontName='DejaVu-Bold', fontSize=8.6, leading=11, textColor=colors.white),
    'blks': ParagraphStyle('blks', fontName='DejaVu', fontSize=7.4, leading=9.4, textColor=colors.white),
    'title': ParagraphStyle('title', fontName='DejaVu-Bold', fontSize=11.5, leading=14, textColor=INK),
    'meta': ParagraphStyle('meta', fontName='DejaVu', fontSize=7.8, leading=10, textColor=GREY),
    'nohy': ParagraphStyle('nohy', fontName='DejaVu', fontSize=8.4, leading=10.6, textColor=RED),
    'jak': ParagraphStyle('jak', fontName='DejaVu', fontSize=7.9, leading=10, textColor=INK),
}


def meta_text(cvik):
    casti = [f"Pružiny: {cvik['pruziny']}", cvik['opakovani']]
    if cvik['strany']:
        casti.append('obě strany')
    return ' · '.join(casti)


class CvikRadek(Flowable):
    """Jeden řádek: název, červená řádka Nohy, popis a dva snímky vedle sebe."""

    def __init__(self, cvik, blok, snimky, vystup, height):
        super().__init__()
        self.cvik, self.blok, self.snimky, self.vystup = cvik, blok, snimky, vystup
        self.height = height

    def wrap(self, aw, ah):
        self.width = aw
        return aw, self.height

    def draw(self):
        c, cv, bl = self.canv, self.cvik, self.blok
        w, h = self.width, self.height
        barva = colors.HexColor(bl['barva'])
        y = h - 1.5 * mm

        # číslo v kroužku v barvě bloku + název
        r = 3.6 * mm
        c.setFillColor(barva)
        c.circle(r, y - r, r, stroke=0, fill=1)
        c.setFillColor(colors.white)
        c.setFont('DejaVu-Bold', 9.5 if cv['c'] < 10 else 8.5)
        c.drawCentredString(r, y - r - 1.2 * mm, str(cv['c']))
        tx = 2 * r + 2.5 * mm
        p = para(cv['nazev'], ST['title'])
        p.wrap(w - tx, 20 * mm)
        p.drawOn(c, tx, y - 5.2 * mm)
        m = Paragraph(f"<font color='{bl['barva']}'><b>{escape(cz(bl['nazev'].upper()))}</b></font>"
                      f"  ·  {escape(cz(meta_text(cv)))}", ST['meta'])
        _, mh = m.wrap(w - tx, 10 * mm)
        m.drawOn(c, tx, y - 5.2 * mm - mh - 0.6 * mm)
        y -= 2 * r + 2.2 * mm

        for text, style in ((f"Nohy: {cv['nohy']}", ST['nohy']), (cv['jak'], ST['jak'])):
            p = para(text, style)
            _, ph = p.wrap(w, 30 * mm)
            p.drawOn(c, 0, y - ph)
            y -= ph + 1.0 * mm

        # dva snímky vedle sebe s popiskem
        cap_h = 4.6 * mm
        img_w = (w - GAP) / 2
        img_h = y - cap_h - 3.5 * mm
        pomer = img_w / img_h
        for k, (poloha, popisek) in enumerate((('vychozi', 'VÝCHOZÍ POLOHA'), ('provedeni', 'PROVEDENÍ'))):
            x = k * (img_w + GAP)
            iy = y - img_h
            img, ze_videa = self.snimky(cv, poloha)
            if img is not None:
                img = priprav(img, cv, poloha, pomer, ze_videa, px_w=1100)
                if self.vystup:
                    img.save(self.vystup / f"{cv['c']:02d}-{poloha}.png")
                buf = io.BytesIO()
                img.save(buf, 'JPEG', quality=88)
                buf.seek(0)
                c.drawImage(ImageReader(buf), x, iy, img_w, img_h)
            else:
                c.setFillColor(PAPER)
                c.setStrokeColor(LIGHT)
                c.rect(x, iy, img_w, img_h, stroke=1, fill=1)
                c.setFillColor(GREY)
                c.setFont('DejaVu', 8)
                c.drawCentredString(x + img_w / 2, iy + img_h / 2, cz(f"snímek z videa v {cv[poloha]}"))
            c.setStrokeColor(LIGHT)
            c.setLineWidth(0.6)
            c.rect(x, iy, img_w, img_h, stroke=1, fill=0)
            c.setFillColor(INK)
            c.setFont('DejaVu-Bold', 7.6)
            c.drawString(x, iy - 3.6 * mm, popisek)
            c.setFillColor(GREY)
            c.setFont('DejaVu', 7.2)
            c.drawRightString(x + img_w, iy - 3.6 * mm, f"video {cv[poloha]}")

        c.setStrokeColor(LIGHT)
        c.setLineWidth(0.8)
        c.line(0, 0.4 * mm, w, 0.4 * mm)


def prehled(data):
    """Úvodní stránka: vybavení, pružiny a plán lekce po blocích."""
    out = [para(data['nazev'], ST['h1']), Spacer(1, 1.5 * mm), para(data['podtitul'], ST['sub']), Spacer(1, 4 * mm)]

    vyb = [para('Vybavení', ST['h2'])] + [para('• ' + v, ST['txt']) for v in data['vybaveni']]
    pr = Table([[para('Ve videu', ST['tdb']), para('TRINFIT Light', ST['tdb'])]] +
               [[para(a, ST['td']), para(b, ST['td'])] for a, b in data['pruziny']],
               colWidths=[30 * mm, 52 * mm])
    pr.setStyle(TableStyle([('LINEBELOW', (0, 0), (-1, -1), 0.4, LIGHT), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                            ('TOPPADDING', (0, 0), (-1, -1), 1.5), ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5)]))
    info = Table([[vyb, [para('Pružiny', ST['h2']), pr]]], colWidths=[96 * mm, None])
    info.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0)]))
    out += [info, Spacer(1, 3 * mm)]

    sirky = [8 * mm, 54 * mm, None, 25 * mm, 13 * mm]
    for bl in data['bloky']:
        barva = colors.HexColor(bl['barva'])
        hl = Table([[Paragraph(f"{bl['id']}  {escape(cz(bl['nazev']))}", ST['blk']),
                     Paragraph(escape(cz(f"{bl['cas']} · pružiny {bl['pruziny']}")), ST['blk'])],
                    [Paragraph(escape(cz(bl['nastaveni'])), ST['blks']), '']],
                   colWidths=[None, 58 * mm])
        hl.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), barva), ('SPAN', (0, 1), (1, 1)),
                                ('ALIGN', (1, 0), (1, 0), 'RIGHT'), ('TOPPADDING', (0, 0), (-1, -1), 1.6),
                                ('BOTTOMPADDING', (0, 0), (-1, -1), 1.6)]))
        rows = []
        for cv in data['cviky']:
            if cv['blok'] != bl['id']:
                continue
            opak = cv['opakovani'] + (' · obě strany' if cv['strany'] else '')
            rows.append([para(str(cv['c']), ST['tdb']), para(cv['nazev'], ST['tdb']),
                         para('Nohy: ' + cv['nohy'], ST['tdn']), para(opak, ST['td']),
                         para(cv['vychozi'], ST['td'])])
        if not rows:  # blok bez cviků (např. seznámení se strojem)
            out += [hl, Spacer(1, 2.2 * mm)]
            continue
        t = Table(rows, colWidths=sirky)
        t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LINEBELOW', (0, 0), (-1, -1), 0.4, LIGHT),
                               ('TOPPADDING', (0, 0), (-1, -1), 1.6), ('BOTTOMPADDING', (0, 0), (-1, -1), 1.6)]))
        out += [KeepTogether([hl, t]), Spacer(1, 2.2 * mm)]

    out += [para('Poznámky', ST['h2'])] + [para('• ' + p, ST['txt']) for p in data['poznamky']]
    return out


def build(args):
    data = json.loads(Path(args.lekce).read_text(encoding='utf-8'))
    bloky = {b['id']: b for b in data['bloky']}
    snimky = Snimky(args, data)
    vystup = Path(args.obrazky) if args.obrazky else None
    if vystup:
        vystup.mkdir(parents=True, exist_ok=True)
    koncept = bool(args.nahled)
    zdroj = data.get('zdroj_snimku', '') if args.snimky else 'snímky jen pro vnitřní potřebu lekce'

    def paticka(c, doc):
        c.saveState()
        c.setFillColor(GREY)
        v = data['video']
        text = cz(f"Podle videa: {v['autor']} – {v['titulek']}, {v['url']} · {zdroj}")
        # písmo se zmenší, aby se patička vešla vedle čísla stránky
        size = min(6.8, 6.8 * (PAGE_W - 2 * MARGIN - 8 * mm) / pdfmetrics.stringWidth(text, 'DejaVu', 6.8))
        c.setFont('DejaVu', size)
        c.drawString(MARGIN, 7 * mm, text)
        c.setFont('DejaVu', 6.8)
        c.drawRightString(PAGE_W - MARGIN, 7 * mm, str(doc.page))
        c.restoreState()

    def zahlavi(c, doc):
        paticka(c, doc)
        c.saveState()
        c.setFont('DejaVu-Bold', 8)
        c.setFillColor(INK)
        c.drawString(MARGIN, PAGE_H - 10 * mm, cz(data['nazev']))
        if koncept:
            c.setFillColor(RED)
            c.setFont('DejaVu-Bold', 7.5)
            c.drawRightString(PAGE_W - MARGIN, PAGE_H - 10 * mm,
                              cz('KONCEPT – náhledy 160×90 px, ostré snímky dodá video'))
        c.setStrokeColor(LIGHT)
        c.line(MARGIN, PAGE_H - 12 * mm, PAGE_W - MARGIN, PAGE_H - 12 * mm)
        c.restoreState()

    doc = BaseDocTemplate(args.vystup, pagesize=A4, title=data['nazev'], author='Tereza Kučko',
                          leftMargin=MARGIN, rightMargin=MARGIN, topMargin=MARGIN, bottomMargin=BOTTOM)
    fw = PAGE_W - 2 * MARGIN
    f1 = Frame(MARGIN, BOTTOM, fw, PAGE_H - MARGIN - BOTTOM, id='prehled', leftPadding=0, rightPadding=0,
               topPadding=0, bottomPadding=0)
    fh = PAGE_H - TOP - BOTTOM
    f2 = Frame(MARGIN, BOTTOM, fw, fh, id='cviky', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([PageTemplate('prehled', [f1], onPage=paticka),
                          PageTemplate('cviky', [f2], onPage=zahlavi)])

    row_h = fh / ROWS_PER_PAGE - 0.01
    story = prehled(data) + [NextPageTemplate('cviky'), PageBreak()]
    story += [CvikRadek(cv, bloky[cv['blok']], snimky, vystup, row_h) for cv in data['cviky']]
    doc.build(story)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('lekce', help='soubor lekce, např. zacatecnici-1.json')
    zdroj = ap.add_mutually_exclusive_group()
    zdroj.add_argument('--video', help='video lekce (mp4/webm); snímky se vytáhnou přes ffmpeg')
    zdroj.add_argument('--snimky', help='složka se snímky NN-vychozi.png / NN-provedeni.png')
    zdroj.add_argument('--nahled', help='složka s náhledovými mozaikami M0.jpg … M13.jpg (koncept)')
    ap.add_argument('--posun', type=float, default=0.0, help='posun časů ve videu v sekundách (např. 0.5)')
    ap.add_argument('--cache', help='kam ukládat snímky vytažené z videa (výchozí snimky-z-videa/<lekce>)')
    ap.add_argument('--obrazky', help='uložit i hotové obrázky (PNG) do této složky')
    ap.add_argument('-o', '--vystup', help='výsledné PDF (výchozí <lekce>.pdf vedle souboru lekce)')
    args = ap.parse_args()
    lekce = Path(args.lekce)
    args.cache = args.cache or str(HERE / 'snimky-z-videa' / lekce.stem)
    args.vystup = args.vystup or str(lekce.with_suffix('.pdf'))
    build(args)


if __name__ == '__main__':
    main()
