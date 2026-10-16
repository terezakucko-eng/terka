# Brand Book 4.0 – Růžový slon

Interní brand book značky Slon 4.0. Strategickou část oficiálního visualbooku (ruzovyslon.visualbook.pro/strategie-znacky) přebírá doslovně a dává jí editorialový layout pro onboarding, agentury a partnery.

Výsledný soubor: `Slon_4_0_brand_book.html` (jeden soubor, asi 600 kB, obrázky jsou vložené uvnitř).

## Jak soubor otevřít

Stačí dvojklik, otevře se v prohlížeči (Chrome, Edge, Safari, Firefox). Nic se neinstaluje.

- Písma Inter Tight a Roboto se načítají z Google Fonts. Bez internetu se použije Arial nebo Helvetica, obsah zůstane stejný.
- Horní navigace skáče na jednotlivé sekce. Na mobilu se dá posouvat do stran.

## Export do PDF

1. Otevřete soubor v Chrome nebo Edge.
2. Ctrl+P (na Macu Cmd+P).
3. Cíl: **Uložit jako PDF**.
4. Formát papíru **A4**, okraje **Výchozí**.
5. V části Další nastavení zapněte **Grafika na pozadí**, jinak se nevytisknou barevné plochy.
6. Uložit.

Tisková verze skryje navigaci, z úvodu udělá titulní stranu a každou hlavní sekci začne na nové straně. Výsledek má zhruba 13 stran A4.

## Zdrojové assety

Všechny grafické prvky pocházejí z oficiálního visualbooku:

| Soubor v `assets/` | Zdroj ve visualbooku | Kde je v brand booku |
|---|---|---|
| `ruzovy_slon_logo_rgb-03_symbol-in-frame-color.svg` | Loga → Symbol v pusince | navigace, pata, ikona záložky |
| `dzin-v1.svg` | Grafické prvky → Slon → Džin V1 | úvod |
| `dzin-v2.svg` | Grafické prvky → Slon → Džin V2 | sekce Džin – průvodce světem přání |
| `pusinka-rozmazana-730.webp` | Grafické prvky → Rozostřená pusinka (zmenšeno na 730 px) | pozadí úvodu |
| `dzin-v2-hlava-200.webp` | výřez z Džina V2 (200 × 200 px) | brand kód Maskot – Slon |

Další prvky:

- Symbol pusinky u brand kódu Symbol – Pusinka je oficiální `symbol-pusinky.svg` z visualbooku, vložený přímo do HTML.
- Ostatní piktogramy brand kódů jsou z otevřené sady Tabler Icons (licence MIT), vložené přímo do HTML. Pro brand kódy oficiální piktogramy neexistují, proto jsme nekreslili vlastní.
- Barvy, gradienty a písma odpovídají sekcím Barvy a Písma ve visualbooku.
- Citát „Tady jsem v bezpečí…“ a Tři pilíře značky jsou ve visualbooku jen jako obrázky. V brand booku jsou přepsané doslovně jako text.

Originály ke stažení: https://ruzovyslon.visualbook.pro/loga a https://ruzovyslon.visualbook.pro/graficke-prvky

## Úpravy a nové sestavení

Výsledný HTML soubor se needituje ručně. Sestavuje se ze šablony:

```
brand-book/
  src/brand_book.src.html    šablona: texty, styly, struktura
  assets/                    obrázky; v šabloně se na ně odkazuje jako {{asset:soubor}}
  build.py                   sestavení
../tools/nbsp.py             nezlomitelné mezery (sdílené s ostatními dokumenty)
```

Postup:

1. Upravte `src/brand_book.src.html`.
2. Spusťte `python3 build.py` (stačí Python 3, nic dalšího).
3. Skript vloží obrázky jako base64, zmenší SVG Džina, doplní nezlomitelné mezery po k, s, v, z, a, i, o, u a ohlídá, aby soubor nepřesáhl 1 MB.

Pravidla pro texty: doslova podle visualbooku, žádné nové nadpisy ani podtitulky, české uvozovky „…“, spisovné tvary. Barvy jen z oficiální palety, písma jen Inter Tight a Roboto.
