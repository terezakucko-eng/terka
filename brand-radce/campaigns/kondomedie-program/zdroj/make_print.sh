#!/bin/sh
# Tiskové PDF Kondomedie: reportlab (oficiální CMYK, skutečná písma)
#  -> Ghostscript (písma do křivek, RGB obrázky do ISO Coated v2 / FOGRA39)
#  -> TrimBox a BleedBox -> náhled.
# Potřeba: python3 (reportlab, svglib, pikepdf, qrcode, pillow, numpy), ghostscript,
# profil ISOcoated_v2_eci.icc (balíček icc-profiles nebo www.eci.org), případně ICC=cesta.
set -e
cd "$(dirname "$0")"
ICC="${ICC:-/usr/share/color/icc/ISOcoated_v2_eci.icc}"
OUT=..
NAME=Kondomedie_RuzovySlon_A5_tisk_CMYK.pdf
python3 build_print.py
gs -q -dBATCH -dNOPAUSE -dSAFER -sDEVICE=pdfwrite -dCompatibilityLevel=1.6 -dNoOutputFonts \
 -sColorConversionStrategy=CMYK -dProcessColorModel=/DeviceCMYK -sOutputICCProfile="$ICC" \
 -dDownsampleColorImages=false -dDownsampleGrayImages=false -dAutoFilterColorImages=false -dColorImageFilter=/FlateEncode \
 -dAutoFilterGrayImages=false -dGrayImageFilter=/FlateEncode -o build/cmyk.pdf build/raw.pdf
python3 - "$OUT/$NAME" <<'PY'
import sys, pikepdf
mm = 72 / 25.4; B = 3 * mm
pdf = pikepdf.open('build/cmyk.pdf'); pg = pdf.pages[0]
W, H = [float(v) for v in pg.MediaBox[2:]]
pg.obj.TrimBox = pikepdf.Array([round(B, 3), round(B, 3), round(W - B, 3), round(H - B, 3)])
pg.obj.BleedBox = pikepdf.Array([0, 0, W, H])
with pdf.open_metadata() as meta:
    meta['dc:title'] = 'Růžový slon – Kondomedie, inzerce A5 (148 × 210 mm + 3 mm spadávka)'
    meta['dc:creator'] = ['Růžový slon']
pdf.save(sys.argv[1])
PY
gs -q -dBATCH -dNOPAUSE -sDEVICE=png16m -r150 -dTextAlphaBits=4 -dGraphicsAlphaBits=4 -dUseTrimBox -o "$OUT/nahled.png" "$OUT/$NAME"
rm -rf build
echo "Fontů v PDF: $(pdffonts "$OUT/$NAME" | tail -n +3 | wc -l)"
pdfimages -list "$OUT/$NAME" | awk 'NR>2{print "obrázek:", $3, $4"x"$5, $6, $13, "ppi"}'
pdfinfo -box "$OUT/$NAME" | grep -E "Page size|TrimBox|BleedBox"
