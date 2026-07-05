# Ad Banner Generator

Webová aplikace pro tvorbu reklamních bannerů v čistém **HTML / CSS / JavaScriptu**
— bez backendu, bez build kroku, bez závislostí. Vše běží v prohlížeči.

## Funkce

- **Formáty** (rozšiřitelné): `300×250`, `728×90`, `970×250`, `300×600`, `320×100`
- **Editor**: upload vizuálu, headline, subline, CTA tlačítko, výběr šablony
- **Brand**: barvy a fonty se načítají z konfiguračního souboru [`brand.json`](brand.json)
- **Jazykové mutace**: CZ, SK, HU, RO, SI, HR, BG — každá s vlastními texty
- **Přepínač Safe / Full** vizuálu (omezení citlivého/adult obsahu v display sítích)
- **Export PNG** přes `<canvas>` — jednotlivě i hromadně
- **Hromadný export** všech rozměrů × jazyků do jednoho **ZIP** (bez knihoven)
- **Ukládání rozpracovaných bannerů** do `localStorage` (pojmenované projekty + autosave)

## Spuštění

Aplikace potřebuje běžet přes HTTP server (kvůli `fetch('brand.json')`),
ne přes `file://`. Stačí libovolný statický server:

```bash
cd ad-banner-generator
python3 -m http.server 8080
# otevři http://localhost:8080
```

nebo `npx serve`, `php -S localhost:8080` apod.

## Jak se to používá

1. **Formát & šablona** — vyber rozměr a jednu ze šablon
   (`overlay`, `classic`, `split`, `minimal`). Renderer se přizpůsobí poměru stran.
2. **Vizuál** — nahraj obrázek pro **Full** a/nebo **Safe** verzi a přepínačem
   zvol, která se zobrazí. Šablona `minimal` funguje i bez vizuálu.
3. **Texty** — přepínej záložky jazyků a uprav headline / subline / CTA.
   Tlačítko „Výchozí texty" obnoví přednastavené překlady daného jazyka.
4. **Export** — stáhni aktuální PNG, nebo zaškrtni formáty + jazyky + verzi
   a vyexportuj vše najednou do ZIP.
5. **Projekty** — rozpracovaný stav ulož pod názvem do `localStorage`,
   později načti nebo smaž. Poslední stav se navíc ukládá automaticky.

## Konfigurace značky — `brand.json`

```jsonc
{
  "name": "Acme Brand",
  "colors": {
    "primary": "#0B5FFF",
    "secondary": "#0A2540",
    "accent": "#FF7A00",
    "background": "#FFFFFF",
    "surface": "#F4F7FB",
    "text": "#0A2540",
    "textMuted": "#5A6B82",
    "ctaBackground": "#FF7A00",
    "ctaText": "#FFFFFF"
  },
  "fonts": {
    "heading": { "family": "Poppins, Arial, sans-serif", "weight": 700, "url": "https://…" },
    "body":    { "family": "Inter, Arial, sans-serif",   "weight": 400, "url": "https://…" }
  },
  "logoText": "ACME"
}
```

- `colors` řídí pozadí, texty i CTA tlačítko ve všech šablonách.
- `fonts.*.url` je volitelná — pokud je uvedená (např. Google Fonts), font se
  načte a použije i při kreslení na canvas. Bez URL se použije systémový font
  z `family`.

## Rozšíření o nový formát / jazyk

Vše je v [`js/config.js`](js/config.js):

- **Nový formát** → přidej položku do `FORMATS` (`id`, `label`, `width`, `height`).
- **Nový jazyk** → přidej položku do `LANGUAGES` (`code`, `label`, `defaults`).
- **Nová šablona** → přidej do `TEMPLATES` a doplň větev v `js/renderer.js`.

## Struktura projektu

```
ad-banner-generator/
├── index.html
├── brand.json          # konfigurace značky (barvy, fonty)
├── css/style.css
└── js/
    ├── config.js       # formáty, jazyky, šablony
    ├── renderer.js     # kreslení banneru na canvas (náhled i export)
    ├── zip.js          # minimální ZIP writer (bez závislostí)
    └── app.js          # stav, UI, export, localStorage
```

## Poznámky

- Export je **pixel-přesný**: náhled i PNG používají stejnou render funkci,
  takže výsledek odpovídá náhledu.
- ZIP se skládá metodou *store* (bez komprese) — PNG jsou už komprimované,
  takže velikost je prakticky stejná a nepotřebujeme žádnou knihovnu.
