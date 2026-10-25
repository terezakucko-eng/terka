# Reformer Strength 55 min – návod se snímky

Tištěný návod k lekci podle videa [Neve McKee Pilates – REFORMER STRENGTH | 55 minutes](https://www.youtube.com/watch?v=evZSmhx7iT4),
přepsaný na TRINFIT Light pro 6 lidí. A4 na výšku: dvě strany plánu po blocích, pak 26 cviků, tři na stránku.
U každého cviku je název, červená řádka „Nohy: …“ a dva snímky VÝCHOZÍ POLOHA / PROVEDENÍ s červenou šipkou pohybu.

- `cviky.json` – bloky, cviky, pružiny, opakování, poloha nohou a čas obou snímků ve videu
- `navod.py` – generátor PDF (Python 3, reportlab, Pillow, ffmpeg)

## Spuštění

```sh
# ostré snímky přímo z videa (časy z cviky.json)
python3 navod.py --video reformer-strength.mp4

# vlastní fotky ze studia nebo screenshoty: 01-vychozi.jpg, 01-provedeni.jpg … 26-provedeni.jpg
python3 navod.py --snimky fotky/

# koncept z náhledových mozaik YouTube (M0.jpg … M13.jpg, 160×90 px)
python3 navod.py --nahled mozaiky/
```

Bez zdroje vzniknou místo snímků prázdné rámečky s časem ve videu. `--obrazky slozka/` uloží i hotové
obrázky jako PNG, `--posun 0.5` posune všechny časy, `-o soubor.pdf` určí výstup.

## Úpravy

- Jiný okamžik ve videu: přepiš `vychozi` / `provedeni` (m:ss).
- Výřez ze záběru: `vyrez` = [střed x, střed y, výška] v podílech snímku.
- Šipky: `sipky` – úsečka `[[x1, y1], [x2, y2]]` nebo oblouk `[[x1, y1], [kx, ky], [x2, y2]]`, souřadnice v podílech celého snímku z videa.
- U vlastních fotek se výřez ani šipky nepoužijí, fotka se jen ořízne na rámeček.

Snímky z videa ani hotové PDF se do repozitáře neukládají – repo je veřejné a práva k záběrům má autorka videa.
