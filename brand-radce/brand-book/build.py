#!/usr/bin/env python3
"""Sestaví Slon_4_0_brand_book.html ze šablony src/brand_book.src.html.

- {{asset:soubor}} nahradí base64 data URI ze složky assets/
- SVG ilustrace zmenší (zaokrouhlení souřadnic na 1 desetinné místo)
- doplní nezlomitelné mezery po jednopísmenných předložkách a spojkách
- zkontroluje, že výsledek nepřesáhne 1 MB

Spuštění: python3 build.py   (jen standardní knihovna Pythonu 3)
"""
import base64
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tools"))
import nbsp  # noqa: E402

SRC = os.path.join(HERE, "src", "brand_book.src.html")
ASSETS = os.path.join(HERE, "assets")
OUT = os.path.join(HERE, "Slon_4_0_brand_book.html")
LIMIT = 1024 * 1024
MINIFY_FROM = 50 * 1024

MIME = {".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg"}


def _round_path(d: str) -> str:
    def repl(m):
        num = ("%.1f" % float(m.group())).rstrip("0").rstrip(".")
        # „1.04.55“ jsou dvě čísla; po zaokrouhlení je musí oddělit mezera.
        prev = d[m.start() - 1] if m.start() else ""
        if not num.startswith("-") and (prev.isdigit() or prev == "."):
            num = " " + num
        return num

    return re.sub(r"-?\d*\.\d+", repl, d)


def minify_svg(data: bytes) -> bytes:
    s = data.decode("utf-8")
    # Zaokrouhlujeme jen data cest – hlavička, rozměry a styly zůstávají beze změny.
    s = re.sub(r'(\sd=")([^"]*)(")', lambda m: m.group(1) + _round_path(m.group(2)) + m.group(3), s)
    s = re.sub(r">\s+<", "><", s)
    return s.strip().encode("utf-8")


def data_uri(name: str) -> str:
    path = os.path.join(ASSETS, name)
    ext = os.path.splitext(name)[1].lower()
    with open(path, "rb") as f:
        data = f.read()
    if ext == ".svg" and len(data) > MINIFY_FROM:
        data = minify_svg(data)  # jen velké ilustrace (Džin); loga zůstávají přesně podle originálu
    return "data:%s;base64,%s" % (MIME[ext], base64.b64encode(data).decode("ascii"))


def main() -> int:
    with open(SRC, encoding="utf-8") as f:
        html = f.read()

    cache = {}

    def repl(m):
        name = m.group(1)
        if name not in cache:
            cache[name] = data_uri(name)
        return cache[name]

    html = re.sub(r"\{\{asset:([^}]+)\}\}", repl, html)
    html = nbsp.fix_html(html)

    leftover = re.findall(r"\{\{[^}]*\}\}", html)
    if leftover:
        print("Nenahrazené zástupné značky:", leftover)
        return 1

    with open(OUT, "w", encoding="utf-8") as f:
        f.write(html)

    size = os.path.getsize(OUT)
    print("Hotovo: %s (%.0f kB)" % (os.path.relpath(OUT), size / 1024))
    if size > LIMIT:
        print("Soubor je větší než 1 MB.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
