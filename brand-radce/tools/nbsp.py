#!/usr/bin/env python3
"""Nezlomitelné mezery po jednopísmenných předložkách a spojkách.

Po samostatném k, s, v, z, a, i, o, u (malých i velkých) nahradí mezeru
nezlomitelnou, aby písmeno nezůstalo viset na konci řádku.

Použití:
  python3 nbsp.py soubor.md [další.md ...]   přepíše soubory na místě
  python3 nbsp.py --check soubor.md ...      jen vypíše chybějící místa (exit 1)

V Markdownu se vkládá znak U+00A0 a přeskakují se bloky kódu, `kód`
a adresy odkazů. V HTML se vkládá entita &nbsp; a jen do textu mimo
značky, <script> a <style>.
"""
import re
import sys

LETTERS = "kKsSvVzZaAiIoOuU"
NBSP = " "

# Písmeno nesmí navazovat na jiné písmeno, číslici ani spojovník (např. „V1“, „e-shop“).
_MD = re.compile(r"(?<![\w-])([" + LETTERS + r"])[ \t]+(?=\S)")
_HTML = re.compile(r"(?<![\w-])([" + LETTERS + r"])\s+(?=\S)")


def fix_text(text: str, html: bool = False) -> str:
    """Opraví prostý text (bez značek)."""
    if html:
        return _HTML.sub(r"\1&nbsp;", text)
    return _MD.sub(r"\1" + NBSP, text)


_MD_PROTECTED = re.compile(
    r"(```.*?```|`[^`\n]*`|\]\([^)]*\)|<[^>\n]+>|https?://\S+)", re.S
)


def fix_markdown(src: str) -> str:
    parts = _MD_PROTECTED.split(src)
    return "".join(p if i % 2 else fix_text(p) for i, p in enumerate(parts))


_HTML_TOKENS = re.compile(r"(<!--.*?-->|<[^>]+>)", re.S)
_HTML_TAIL = re.compile(r"(?<![\w-])([" + LETTERS + r"])\s+$")
_INLINE_OPEN = re.compile(r"<(strong|em|b|i|a|span)\b", re.I)


def fix_html(src: str) -> str:
    parts = _HTML_TOKENS.split(src)
    out = []
    skip = None  # název značky, uvnitř které se text nemění
    for i, part in enumerate(parts):
        if i % 2:
            out.append(part)
            m = re.match(r"<(/?)(script|style|svg|code|pre)\b", part, re.I)
            if m:
                skip = None if m.group(1) else m.group(2).lower()
            continue
        if skip:
            out.append(part)
            continue
        part = fix_text(part, html=True)
        # „a <strong>slovo</strong>“ – písmeno na konci textu před inline značkou
        if i + 1 < len(parts) and _INLINE_OPEN.match(parts[i + 1]):
            part = _HTML_TAIL.sub(r"\1&nbsp;", part)
        out.append(part)
    return "".join(out)


def fix_file_content(path: str, src: str) -> str:
    return fix_html(src) if path.lower().endswith((".html", ".htm")) else fix_markdown(src)


def missing(path: str, src: str):
    """Vrátí řádky, kde po úpravě vznikla změna (tj. mezera chybí)."""
    fixed = fix_file_content(path, src)
    a, b = src.splitlines(), fixed.splitlines()
    return [(n + 1, line) for n, (line, new) in enumerate(zip(a, b)) if line != new]


def main(argv):
    check = "--check" in argv
    paths = [a for a in argv if a != "--check"]
    if not paths:
        print(__doc__)
        return 2
    bad = 0
    for path in paths:
        with open(path, encoding="utf-8") as f:
            src = f.read()
        if check:
            for n, line in missing(path, src):
                bad += 1
                print(f"{path}:{n}: {line.strip()[:100]}")
        else:
            fixed = fix_file_content(path, src)
            if fixed != src:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(fixed)
                print(f"upraveno: {path}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
