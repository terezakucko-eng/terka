"""Test "projet kolem" a kontrola kontrastu pro grafiku Růžového slona.

Použití:
    python simulace.py <vstup.png|jpg|pdf> <výstup.png> [--typ billboard|banner|tisk|foto]

Vytvoří jeden obrázek s originálem, simulací pohledu z dálky / v malé velikosti
a černobílou verzí (kontrola kontrastu). Vyžaduje Pillow; PDF převádí přes pdftoppm.
"""
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

# (popisek, šířka v px, rozmazání) – čím menší šířka, tím větší vzdálenost / menší zobrazení
SIMULACE = {
    "billboard": [("~30 m (stojíte u silnice)", 260, 0.6),
                  ("~70 m (přijíždíte autem)", 110, 0.9),
                  ("~120 m, 2 s pohled za jízdy", 65, 1.2)],
    "banner": [("Mobil, rychlé scrollování", 180, 0.5),
               ("Banner v rohu stránky", 120, 0.7),
               ("Letmý pohled (1 s)", 80, 1.0)],
    "tisk": [("Na délku paže", 400, 0.3),
             ("Z druhé strany prodejny (~3 m)", 140, 0.8),
             ("Výloha z chodby OC (~8 m)", 80, 1.1)],
    "foto": [("Medailonek na webu (175 px)", 175, 0.0),
             ("Mobil (90 px)", 90, 0.3),
             ("Náhled v seznamu (60 px)", 60, 0.5)],
}


def nacti(cesta: Path) -> Image.Image:
    if cesta.suffix.lower() == ".pdf":
        tmp = Path(tempfile.mkdtemp())
        subprocess.run(["pdftoppm", "-r", "60", "-png", "-f", "1", "-l", "1", str(cesta), str(tmp / "p")], check=True)
        cesta = next(tmp.glob("p*.png"))
    return Image.open(cesta).convert("RGB")


def sim(im: Image.Image, px: int, blur: float) -> Image.Image:
    w, h = im.size
    s = im.resize((px, max(1, int(px * h / w))), Image.LANCZOS)
    if blur:
        s = s.filter(ImageFilter.GaussianBlur(blur))
    return s.resize((w, h), Image.NEAREST)


def main() -> None:
    vstup, vystup = Path(sys.argv[1]), Path(sys.argv[2])
    typ = sys.argv[sys.argv.index("--typ") + 1] if "--typ" in sys.argv else "billboard"
    src = nacti(vstup)
    sirka = 1000
    src = src.resize((sirka, int(sirka * src.size[1] / src.size[0])))
    w, h = src.size
    panely = [("Originál", src)] + [(t, sim(src, px, b)) for t, px, b in SIMULACE[typ]]
    panely.append(("Černobílý kontrast", ImageOps.grayscale(src).convert("RGB")))
    pad, gap = 50, 30
    out = Image.new("RGB", (w * 2 + gap, (h + pad) * 3), "white")
    d = ImageDraw.Draw(out)
    try:
        f = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf", 26)
    except OSError:
        f = ImageFont.load_default()
    for i, (titulek, im) in enumerate(panely):
        x, y = (i % 2) * (w + gap), (i // 2) * (h + pad)
        d.text((x, y + 8), titulek, fill=(36, 10, 73), font=f)
        out.paste(im, (x, y + pad - 5))
    out.save(vystup)
    print(vystup)


if __name__ == "__main__":
    main()
