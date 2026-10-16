"""Tiskové PDF: Kondomedie, celostránková inzerce A5.

Geometrie odpovídá Figma návrhu (rámec 420 × 595, souřadnice shora dolů).
Barvy jsou rovnou v oficiálních CMYK hodnotách z visualbooku, písma jsou
skutečné Inter Tight / Roboto / Caveat. Výstup se pak převádí Ghostscriptem
(písma do křivek, RGB obrázky do ISO Coated v2 / FOGRA39).
"""
import math, os, re, sys
import numpy as np
import qrcode
from PIL import Image, ImageDraw, ImageFilter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import CMYKColor
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics import renderPDF
from svglib.svglib import svg2rlg

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, 'assets')
OUT = os.path.join(HERE, 'build')
os.makedirs(OUT, exist_ok=True)

# Oficiální CMYK (visualbook › Barvy). Manuál převádí RGB -> CMYK přes FOGRA39
# (růžová i krémová tomu přesně odpovídají), stejně je tu převedená Růžová 10.
RUZ = CMYKColor(0, 1, 0.5, 0.05)
TMA = CMYKColor(0.66, 0.73, 0, 0.66)
BILA = CMYKColor(0, 0, 0, 0)
KREM = CMYKColor(0, 0.11, 0.06, 0)
R10 = CMYKColor(0, 0.14, 0.03, 0)       # #FBE5ED
SVG_MAP = {'#dc004e': RUZ, '#ffffff': BILA, '#fff': BILA}

for name, f in [('ITX', 'intertight-extrabold.ttf'), ('ITB', 'intertight-bold.ttf'),
                ('ROB', 'roboto-regular.ttf'), ('CAV', 'caveat-bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name, os.path.join(HERE, 'fonts', f)))

# Formát: A5 + spadávka 3 mm
TW, TH = 148 * mm, 210 * mm
B = 3 * mm
PW, PH = TW + 2 * B, TH + 2 * B
FW, FH = 420.0, 595.0            # Figma rámec
K = TW / FW                       # 1 jednotka Figmy -> pt
BU = B / K                        # spadávka v jednotkách Figmy
DY = -8                           # spodní blok o 8 výš kvůli 5mm bezpečné zóně
SAFE = 5 * mm / K

c = canvas.Canvas(os.path.join(OUT, 'raw.pdf'), pagesize=(PW, PH))
c.setTitle('Růžový slon – Kondomedie, inzerce A5')
c.setAuthor('Růžový slon')
c.translate(B, PH - B)
c.scale(K, -K)                    # od teď kreslíme ve Figma souřadnicích (y dolů)

placed = {}                       # kontrola bezpečné zóny


def note(name, x0, y0, x1, y1):
    placed[name] = (x0, y0, x1, y1)


def flip_draw(x, y, h, fn):
    """Lokálně otočí osu y, aby obrázky/SVG/text nebyly vzhůru nohama."""
    c.saveState(); c.translate(x, y + h); c.scale(1, -1); fn(); c.restoreState()


def recolor(node):
    for attr in ('fillColor', 'strokeColor'):
        col = getattr(node, attr, None)
        if col is not None and not isinstance(col, CMYKColor):
            hx = '#%02x%02x%02x' % tuple(int(round(v * 255)) for v in col.rgb())
            if hx not in SVG_MAP:
                raise SystemExit(f'Neznámá barva v SVG: {hx}')
            setattr(node, attr, SVG_MAP[hx])
    for ch in getattr(node, 'contents', []) or []:
        recolor(ch)


def draw_svg(path, x, y, w):
    d = svg2rlg(path)
    recolor(d)
    s = w / d.width
    h = d.height * s
    def fn():
        c.scale(s, s); renderPDF.draw(d, c, 0, 0)
    flip_draw(x, y, h, fn)
    return h


def text(x, baseline, s, font, size, color, ls_em=0.0):
    c.saveState(); c.translate(x, baseline); c.scale(1, -1)
    t = c.beginText(0, 0)
    t.setFont(font, size); t.setCharSpace(ls_em * size); t.setFillColor(color)
    t.textOut(s); c.drawText(t); c.restoreState()
    w = pdfmetrics.stringWidth(s, font, size) + ls_em * size * (len(s) - 1)
    return w


# 1) Pozadí: gradient Bílá -> Krémová (Figma gradientTransform [[.5,.5,0],[-.5,.5,.5]])
c.saveState()
p = c.beginPath(); p.rect(-BU, -BU, FW + 2 * BU, FH + 2 * BU); c.clipPath(p, stroke=0, fill=0)
gx, gy = 0.5 / FW, 0.5 / FH
n2 = gx * gx + gy * gy
c.linearGradient(0, 0, gx / n2, gy / n2, (BILA, KREM), extend=True)
c.restoreState()

# 2) Rozostřená pusinka (oficiální tvar, gradient Růžová 20 -> Purpurová 20, blur 30)
KISS_D = 'M1483.97 500L1069.81 123.455C888.757 -41.1515 595.212 -41.1515 414.133 123.455L0 500L414.164 876.545C595.212 1041.15 888.757 1041.15 1069.84 876.545L1484 500H1483.97Z'


def flatten_path(d, steps=48):
    toks = re.findall(r'[MLCHZ]|-?\d*\.?\d+(?:e-?\d+)?', d)
    pts, i, cur, cmd = [], 0, (0, 0), None
    while i < len(toks):
        if toks[i] in 'MLCHZ':
            cmd = toks[i]; i += 1
            if cmd == 'Z':
                continue
        if cmd in 'ML':
            cur = (float(toks[i]), float(toks[i + 1])); i += 2; pts.append(cur)
        elif cmd == 'H':
            cur = (float(toks[i]), cur[1]); i += 1; pts.append(cur)
        elif cmd == 'C':
            p1 = (float(toks[i]), float(toks[i + 1])); p2 = (float(toks[i + 2]), float(toks[i + 3]))
            p3 = (float(toks[i + 4]), float(toks[i + 5])); i += 6
            for s in range(1, steps + 1):
                t = s / steps; mt = 1 - t
                pts.append((mt**3 * cur[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t**3 * p3[0],
                            mt**3 * cur[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t**3 * p3[1]))
            cur = p3
    return pts


KX, KY, KW, KH = 112, 180 + DY, 500, 337
PAD = 60
rx0, ry0 = KX - PAD, KY - PAD
rx1, ry1 = min(KX + KW + PAD, FW + BU), KY + KH + PAD
PPU = K * 300 / 72                # pixelů na jednotku Figmy při 300 dpi
SS = 2                            # supersampling tvaru
wpx, hpx = int((rx1 - rx0) * PPU), int((ry1 - ry0) * PPU)
mask = Image.new('L', (wpx * SS, hpx * SS), 0)
poly = [((KX + x / 1484 * KW - rx0) * PPU * SS, (KY + y / 1000 * KH - ry0) * PPU * SS) for x, y in flatten_path(KISS_D)]
ImageDraw.Draw(mask).polygon(poly, fill=255)
mask = mask.resize((wpx, hpx), Image.LANCZOS).filter(ImageFilter.GaussianBlur(15 * PPU))
yy, xx = np.mgrid[0:hpx, 0:wpx]
u = ((xx / PPU + rx0) - KX) / KW
v = ((yy / PPU + ry0) - KY) / KH
t = np.clip(0.6 * u + 0.4 * v, 0, 1)[..., None]
c0, c1 = np.array([0xF8, 0xCC, 0xDC]), np.array([0xE5, 0xD6, 0xE7])
rgb = (c0 * (1 - t) + c1 * t).round().astype(np.uint8)
kiss = Image.fromarray(np.dstack([rgb, np.array(mask)]), 'RGBA')
kiss_path = os.path.join(OUT, 'pusinka-rozmazana-300dpi.png'); kiss.save(kiss_path)
flip_draw(rx0, ry0, ry1 - ry0, lambda: c.drawImage(ImageReader(kiss_path), 0, 0, rx1 - rx0, ry1 - ry0, mask='auto'))

# 3) Džin s pusinkou −25 % (2000 px na 272 jednotek ≈ 530 dpi)
DZ = os.path.join(ASSETS, 'dzin-pusinka-25.png')
DX, DYY, DS = 150, 206 + DY, 272
flip_draw(DX, DYY, DS, lambda: c.drawImage(ImageReader(DZ), 0, 0, DS, DS, mask='auto'))
note('Džin (viditelná část)', 192.0, 225.3 + DY, 383.9, 456.9 + DY)

# 4) Logo (oficiální horizontální SVG)
lh = draw_svg(os.path.join(ASSETS, 'logo-horizontalni.svg'), 32, 28, 96)
note('Logo', 32, 28, 128, 28 + lh)

# 5) Nadpis (Brand Essence) a pointa
ASC, DESC = 1984 / 2048, 494 / 2048


def base_off(size, lh_px):
    return (lh_px - (ASC + DESC) * size) / 2 + ASC * size


h1 = ['Proměňujeme', 'přání ve', 'skutečnost.']
h1_lh = 33 * 1.04
y = 58
for i, line in enumerate(h1):
    w = text(32, y + i * h1_lh + base_off(33, h1_lh), line, 'ITX', 33, RUZ, -0.02)
    note(f'Nadpis {i+1}', 32, y + i * h1_lh, 32 + w, y + (i + 1) * h1_lh)
y = 58 + 3 * h1_lh + 16
for i, line in enumerate(['Po představení', 'zábava nekončí!']):
    w = text(32, y + i * 24 + base_off(20, 24), line, 'ITB', 20, TMA, -0.02)
    note(f'Pointa {i+1}', 32, y + i * 24, 32 + w, y + (i + 1) * 24)

# 6) Spodní rámeček Růžová 10 (do spadávky)
ST = 462 + DY
c.setFillColor(R10)
c.rect(-BU, ST, FW + 2 * BU, FH + BU - ST + 1, stroke=0, fill=1)

# 7) Nabídka
RY = 480 + DY
w = text(32, RY + base_off(20, 20 * (ASC + DESC)), 'Přídavek na doma.', 'ITB', 20, TMA, -0.02)
note('Přídavek na doma.', 32, RY, 32 + w, RY + 24)
RASC, RDESC = 1900 / 2048, 500 / 2048
t2y = RY + 24 + 8
for i, line in enumerate(['Speciální nabídka pro návštěvníky', 'Divadla Mír se skrývá v QR kódu.']):
    lh_px = 11 * 1.4
    bo = (lh_px - (RASC + RDESC) * 11) / 2 + RASC * 11
    w = text(32, t2y + i * lh_px + bo, line, 'ROB', 11, TMA)
    note(f'Nabídka {i+1}', 32, t2y + i * lh_px, 32 + w, t2y + (i + 1) * lh_px)

# 8) QR kód jako vektor (Tmavá), uprostřed oficiální symbol v pusince
q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, border=2)
q.add_data('https://hov.to/c918daf5'); q.make(fit=True)
mtx = q.get_matrix()
N = len(mtx)
QX, QY, QS = 292, 480 + DY, 96
m = QS / N
note('QR kód (vč. klidové zóny)', QX, QY, QX + QS, QY + QS)
px0, py0, px1, py1 = [QX + v / 660 * QS for v in (219, 251, 441, 408)]  # volná plocha pod logem jako v rastru


def subtract(r, p):
    x0, y0, x1, y1 = r
    a0, b0, a1, b1 = p
    if x1 <= a0 or x0 >= a1 or y1 <= b0 or y0 >= b1:
        return [r]
    out = []
    if x0 < a0: out.append((x0, y0, a0, y1))
    if x1 > a1: out.append((a1, y0, x1, y1))
    ix0, ix1 = max(x0, a0), min(x1, a1)
    if y0 < b0: out.append((ix0, y0, ix1, b0))
    if y1 > b1: out.append((ix0, b1, ix1, y1))
    return out


path = c.beginPath()
for i in range(N):
    j = 0
    while j < N:
        if mtx[i][j]:
            k = j
            while k < N and mtx[i][k]:
                k += 1
            r = (QX + j * m, QY + i * m, QX + k * m, QY + (i + 1) * m)
            for (x0, y0, x1, y1) in subtract(r, (px0, py0, px1, py1)):
                path.rect(x0, y0, x1 - x0, y1 - y0)
            j = k
        else:
            j += 1
c.setFillColor(TMA)
c.drawPath(path, stroke=0, fill=1)
lw_ = 198 / 660 * QS
draw_svg(os.path.join(ASSETS, 'logo-symbol-v-pusince.svg'), QX + 231 / 660 * QS, QY + 263 / 660 * QS, lw_)

# 9) Ručně psané „Pojď si přát“ + šipka
HX, HY = 131, 552 + DY
c.saveState(); c.translate(HX, HY); c.rotate(-5)
c.translate(0, 0.96 * 27); c.scale(1, -1)
tt = c.beginText(0, 0); tt.setFont('CAV', 27); tt.setFillColor(RUZ); tt.textOut('Pojď si přát'); c.drawText(tt)
c.restoreState()
hw = pdfmetrics.stringWidth('Pojď si přát', 'CAV', 27)
cs, sn = math.cos(math.radians(5)), math.sin(math.radians(5))
corners = [(HX + lx * cs + ly * sn, HY - lx * sn + ly * cs) for lx, ly in [(0, 0), (hw, 0), (0, 34), (hw, 34)]]
note('Pojď si přát', min(p[0] for p in corners), min(p[1] for p in corners), max(p[0] for p in corners), max(p[1] for p in corners))

AX, AY = 254, 528 + DY
c.saveState(); c.translate(AX, AY)
c.setStrokeColor(RUZ); c.setLineWidth(2.4); c.setLineCap(1); c.setLineJoin(1)
a = c.beginPath(); a.moveTo(2, 31); a.curveTo(10, 34, 22, 32, 29, 22); a.curveTo(32, 18, 33, 14, 34, 9)
c.drawPath(a, stroke=1, fill=0)
a = c.beginPath(); a.moveTo(27, 13); a.lineTo(34, 8.5); a.lineTo(36.5, 17)
c.drawPath(a, stroke=1, fill=0)
c.restoreState()
note('Šipka', AX + 2 - 1.2, AY + 8.5 - 1.2, AX + 36.5 + 1.2, AY + 34 + 1.2)

c.showPage(); c.save()

# Kontrola bezpečné zóny (5 mm od ořezu)
bad = []
for name, (x0, y0, x1, y1) in placed.items():
    d = min(x0, y0, FW - x1, FH - y1) * K / mm
    flag = 'OK ' if d >= 5 else 'POD'
    if d < 5: bad.append(name)
    print(f'{flag} {name:28s} nejblíž k ořezu {d:5.1f} mm')
qr_mm = (N - 4) * m * K / mm
print(f'QR kód (bez klidové zóny): {qr_mm:.1f} × {qr_mm:.1f} mm, modul {m*K/mm:.2f} mm')
sys.exit(1 if bad else 0)
