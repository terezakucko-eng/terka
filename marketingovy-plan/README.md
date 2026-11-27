# Marketingový plán

Plánování a vyhodnocování marketingových aktivit Růžového slona, Kondomshopu a Flagranti. Nahrazuje
plánovací část staré aplikace rs-publikacni-plan.netlify.app a přidává to, co jí chybělo: výsledek
každé aktivity, plán × skutečnost, roční přehled opakujících se témat, monitoring konkurence a
doporučení, co naplánovat.

## Jak to funguje

- **Jedna stránka v Claude** (artifact), bez serveru a bez hesel. Data čte a zapisuje do sdílené Google
  Tabulky přes **konektor Google Sheets** toho, kdo stránku právě otevřel. Kdo nemá k tabulce přístup,
  data neuvidí.
- **Databáze je Google Tabulka** „Marketingový plán – data“. Aplikace v ní hledá sloupce podle názvu,
  takže jde sloupce přesouvat a přidávat vlastní. Řádky se hledají podle ID, ne podle pořadí, takže
  nevadí řazení ani filtry. Číselníky (značky, kanály, stavy, odpovědní, typy, konkurenti) se upravují
  přímo v listu Číselníky.
- Bez konektoru (stránka otevřená mimo Claude) ukáže vzorová data, jen v paměti okna.

Listy: Aktivity, Výsledky, Číselníky, Roční kalendář, Import – kontrola, Měsíční čísla, Konkurence,
Doporučení.

## Pravidla zápisu, která se nesmí porušit

Zjištěno zkouškou na skutečné tabulce:

- **Nikdy nepřidávat řádky přes `append_values`.** Konektor tím řádek *vloží*, nový řádek přijde o formát
  a rozbije vzorec `ARRAYFORMULA` v listu Výsledky. Nové řádky se proto píšou přes `update_values` do
  prvního volného řádku a zápis se ověří čtením zpět (`Table.append` v `src/data/sheets.ts`).
- `update_values` formáty, výběrové seznamy a vzorce zachovává. `null` v řádku znamená „buňku
  nech být“, prázdný řetězec buňku vymaže.
- Hodnoty se čtou tak, jak je tabulka zobrazuje. Datum bez formátu přijde jako sériové číslo (46330),
  proto `parseDate` umí i to.
- Text, který vypadá jako vzorec, číslo nebo datum, se píše s apostrofem (`safeText`).
- Nuly se do tabulky nepíšou, buňka zůstane prázdná.
- Smazání je jen změna stavu na „Smazáno“, řádek v tabulce zůstává.

## Vývoj

```
npm ci
npm run typecheck
npm test
npm run build     # dist/page.html je stránka pro nástroj Artifact, dist/preview.html se stand-inem za Claude
```

`dist/preview.html` jde otevřít v prohlížeči. Napodobuje konektor nad tabulkou v paměti
(`?seed=empty` pro prázdný plán), takže jde projet celý zápis bez Claude.

## Publikace

Publikuje se soubor `dist/page.html` jako artifact s oprávněními:

```
mcp: Google Sheets (get_values, update_values)
user: profile
downloads
```

ID tabulky je v `src/index.tsx`. Sdílení stránky s kolegyněmi se nastavuje v nabídce Sdílet u
artifactu a každá z nich potřebuje v Claude připojené Google Tabulky a přístup k datové tabulce.

## Struktura

- `src/lib`: čisté funkce (data, čísla v českém formátu, model, stavy, roční kalendář s pohyblivými
  dny, souhrny, pravidla doporučení). Pokryté testy.
- `src/data`: čtení a zápis tabulky (`sheets.ts`, `store.ts`), konektor (`mcpApi.ts`) a tabulka
  v paměti pro testy a ukázku (`mockApi.ts`).
- `src/ui`: obrazovky.
