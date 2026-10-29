# Návody k lekcím na reformeru

Tištěné návody k lekcím podle videí Neve McKee Pilates, přepsané na TRINFIT Light pro 6 lidí.
A4 na výšku: plán po blocích s časy, pak tři cviky na stránku – název, červená řádka „Nohy: …“,
krátký popis a dva obrázky VÝCHOZÍ POLOHA / PROVEDENÍ s červenou šipkou pohybu.

| Soubor lekce | Video | Obrázky |
|---|---|---|
| `zacatecnici-1.json` | [Full Body Reformer Pilates \| 60 minutes](https://www.youtube.com/watch?v=RATdaL_GZik) – první lekce pro začátečníky, 30 cviků | kreslené ilustrace z Canvy (design „Ilustrace reformer – začátečníci“) |
| `uplni-zacatecnici.json` | první hodina, 50 min: 17 cviků ze `zacatecnici-1.json` a 3 dřepy vleže na hrazdě; box se přesouvá jen jednou, žádný blok na každou stranu zvlášť | ilustrace z Canvy přečíslované podle nového pořadí (původní číslo v klíči `puvodni`); dřepy vleže kreslené vektorově |
| `strength-55.json` | [REFORMER STRENGTH \| 55 minutes](https://www.youtube.com/watch?v=evZSmhx7iT4), 26 cviků | snímky z videa |

`navod.py` je generátor (Python 3, reportlab, Pillow, ffmpeg).

## Spuštění

```sh
# ilustrace, vlastní fotky ze studia nebo screenshoty: 01-vychozi.png, 01-provedeni.png … 30-provedeni.png
python3 navod.py zacatecnici-1.json --snimky ilustrace/

# ostré snímky přímo z videa (časy ze souboru lekce)
python3 navod.py strength-55.json --video reformer-strength.mp4

# koncept z náhledových mozaik YouTube (M0.jpg … M13.jpg, 160×90 px)
python3 navod.py strength-55.json --nahled mozaiky/
```

Bez zdroje vzniknou místo obrázků prázdné rámečky s časem ve videu. `--obrazky slozka/` uloží i hotové
obrázky jako PNG, `--posun 0.5` posune časy ve videu, `-o soubor.pdf` určí výstup (jinak `<lekce>.pdf`).

## Úpravy v souboru lekce

- Jiný okamžik ve videu: `vychozi` / `provedeni` (m:ss) – u ilustrací jen jako odkaz do videa.
- Šipky: `sipky` (snímky z videa) nebo `sipky_snimky` (ilustrace a fotky) – úsečka `[[x1, y1], [x2, y2]]`
  nebo oblouk `[[x1, y1], [kx, ky], [x2, y2]]`, souřadnice v podílech celého obrázku.
- Pohyb mimo bokorys: `"schema": "kruh"` (kroužení nohou) nebo `"roznozeni"` – malé schéma v rohu.
- `zacatecnici-1.json` má u každého cviku klíč pózy (`poza`) a v `pozy` zadání pro ilustraci,
  ať jde kterýkoli obrázek vygenerovat znovu stejným stylem.

Obrázky ani hotová PDF se do repozitáře neukládají – repo je veřejné a práva k záběrům z videí má jejich autorka.
