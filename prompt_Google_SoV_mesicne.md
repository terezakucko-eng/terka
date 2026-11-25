# PROMPT – Google reklamy: share of voice Růžový slon vs. konkurence (měsíční kontrola)

Jsi můj asistent v prohlížeči Chrome. Píšeš česky. Jsem přihlášená svým firemním Google účtem. Do přihlašovacích polí nic nezadávej, nic nesdílej, nic neodesílej mailem a nic neplať. Nezakládej v Google Cloudu žádnou fakturaci (billing) – stačí bezplatný BigQuery sandbox.

## Cíl
Jednou měsíčně aktualizovat dashboard s podílem zobrazení reklam v Googlu (share of voice) pro Růžového slona a konkurenci v ČR a SK:
https://docs.google.com/spreadsheets/d/1y4L0-UzI7QcpCeLSMyWEKcMWAMXW1deSH8dwYrcDUPg/edit
Data bereš z veřejné datové sady Googlu „Google Ads Transparency Center“ v BigQuery (stejný zdroj použil mediální auditor Pavol Macinga).

Dashboard má listy:
- **Dashboard** – počítá se sám ze vzorců, do něj nic nepiš.
- **Data** – sem vložíš výsledek dotazu (sloupce A–F). Sloupce G a H jsou vzorce, nesahej na ně.
- **Inzerenti** – seznam firem (přesný název z Googlu), značka a skupina („Skupina Růžový slon“ / „Konkurence“).
- **Kontroly** – po každé kontrole sem přidáš jeden řádek.

## Krok 0 – jen při PRVNÍM spuštění: doplnit konkurenty
1. Otevři https://adstransparency.google.com, region nastav Česko.
2. Postupně vyhledej: E-kondomy, SuperLove, Erotic City, Sexshop.cz, YOO, Deep Love, Erosstar, Sexshopik, Kondomshop; pak region Slovensko: isexshop, eros.sk.
3. U každého zapiš **přesný název firmy (právní název inzerenta)**, jak ho Google ukazuje.
4. Doplň je do listu **Inzerenti** (sloupec A název, B značka, C „Konkurence“). Řádky, které tam už jsou, neměň. Kondomshop.cz/.sk patří Růžovému slonovi – pokud má vlastní firmu jako inzerenta, dej skupinu „Skupina Růžový slon“.
5. Smaž v listu Inzerenti jen pomocný řádek 5 s poznámkou „Další konkurenty… doplní agent“.
6. Napiš mi seznam a **počkej na moje „pokračuj“**.

## Krok 1 – BigQuery
1. Otevři https://console.cloud.google.com/bigquery.
2. Pokud nemám žádný projekt, **zastav se a napiš mi** – projekt (BigQuery sandbox, zdarma, bez karty) založím sama.
3. Otevři nový dotaz (+ / „Untitled query“).

## Krok 2 – Dotaz na zobrazení po měsících
Vlož tento dotaz. Místo `<<SEZNAM>>` vlož všechny názvy z listu Inzerenti, sloupec A, v uvozovkách oddělené čárkou (např. `'Růžový slon s.r.o.', 'Trinet Corp., s.r.o.', 'Czech Healthcare s.r.o.'`).

```sql
DECLARE od DATE DEFAULT '2024-01-01';
WITH reklamy AS (
  SELECT
    c.advertiser_legal_name AS inzerent,
    c.creative_id,
    r.region_code AS zeme,
    DATE(r.first_shown) AS prvni,
    DATE(r.last_shown) AS posledni,
    r.times_shown_lower_bound AS dolni,
    IFNULL(r.times_shown_upper_bound, 10000000) AS horni
  FROM `bigquery-public-data.google_ads_transparency_center.creative_stats` AS c,
       UNNEST(c.region_stats) AS r
  WHERE r.region_code IN ('CZ', 'SK')
    AND c.advertiser_legal_name IN (<<SEZNAM>>)
    AND DATE(r.last_shown) >= od
)
SELECT
  zeme,
  inzerent,
  DATE_TRUNC(den, MONTH) AS mesic,
  COUNT(DISTINCT creative_id) AS reklam,
  ROUND(SUM(dolni / (DATE_DIFF(posledni, prvni, DAY) + 1))) AS zobr_dolni,
  ROUND(SUM(horni / (DATE_DIFF(posledni, prvni, DAY) + 1))) AS zobr_horni
FROM reklamy, UNNEST(GENERATE_DATE_ARRAY(prvni, posledni)) AS den
WHERE den >= od
GROUP BY zeme, inzerent, mesic
ORDER BY zeme, inzerent, mesic;
```

- **Před spuštěním** se podívej vpravo nahoře, kolik dat dotaz zpracuje („This query will process … GB“). Pokud je to víc než **300 GB**, nespouštěj ho a napiš mi číslo (měsíční zdarma limit je 1 TB).
- Pokud dotaz hlásí chybu kvůli názvu sloupce, otevři u tabulky `creative_stats` záložku **Schema**, najdi správné názvy (zobrazení „times shown“ dolní/horní hranice, první/poslední zobrazení, kód regionu), dotaz uprav a napiš mi, co jsi změnil.
- Jak se počítá: Google uvádí zobrazení každé reklamy jen v pásmu za celou dobu jejího běhu; dotaz je rovnoměrně rozpočítá na dny mezi prvním a posledním zobrazením a sečte po měsících. Reklamy nad 10 mil. zobrazení (bez horní hranice) se v horní hranici počítají 10 mil. Je to odhad, ne měření.

## Krok 3 – Do kdy jsou data
Spusť ještě krátký dotaz (stejný `<<SEZNAM>>`):

```sql
SELECT MAX(DATE(r.last_shown)) AS data_do
FROM `bigquery-public-data.google_ads_transparency_center.creative_stats` AS c,
     UNNEST(c.region_stats) AS r
WHERE r.region_code IN ('CZ', 'SK')
  AND c.advertiser_legal_name IN (<<SEZNAM>>);
```

## Krok 4 – Vložit do dashboardu
1. Výsledek dotazu z kroku 2 ulož: **Save results → Google Sheets** (vznikne nová dočasná tabulka).
2. V dočasné tabulce zkopíruj sloupce A–F včetně záhlaví.
3. V dashboardu otevři list **Data**, smaž obsah **A2:F** (jen hodnoty, sloupce G a H nech) a vlož zkopírovaná data do buňky **A1** jako hodnoty (Ctrl+Shift+V). Záhlaví musí zůstat: zeme, inzerent, mesic, reklam, zobr_dolni, zobr_horni.
4. Zkontroluj, že sloupec C (mesic) je datum (např. 2026-08), ne text.
5. Dočasnou tabulku smaž (do koše).
6. V listu **Kontroly** přidej řádek: A dnešní datum, B datum z kroku 3, C poslední celý měsíc v datech, D kolik GB dotaz zpracoval, E 1–2 věty, co je nového.

## Krok 5 – Kontrola dashboardu
- V listu Dashboard musí v bloku ČESKO a SLOVENSKO být měsíce od ledna 2024 a podíl skupiny Růžový slon v %.
- Pokud se v listu Data ve sloupci G objeví „Nezařazeno“, je tam inzerent, který není v listu Inzerenti – napiš mi jeho název.
- Pro kontrolu: Pavol Macinga spočítal za leden–srpen 2026 podíl skupiny Růžový slon (Růžový slon + Flagranti) proti e-kondomy.cz/SuperLove: ČR 54 %, SK 60 %. Pokud porovnáš jen tyto tři firmy, mělo by ti vyjít podobně (±3 p. b.). Pokud ne, napiš mi.

## Krok 6 – Na konci mi napiš
- podíl skupiny Růžový slon za poslední 3 dostupné měsíce v ČR a SK a srovnání se stejnými měsíci loni,
- kdo z konkurence nejvíc vyrostl nebo spadl,
- do kdy Google data zveřejnil a kolik GB dotaz zpracoval,
- co se nepovedlo.

Nic dalšího v tabulce neměň.
