---
name: kontrola-grafiky
description: Kontrola grafiky Růžového slona před odesláním do tisku nebo nasazením – billboardy, bannery, tiskoviny do prodejen, vkládky, fotky na medailonky. Použij, když Tereza pošle vizuál (obrázek, PDF, odkaz na Disk nebo Basecamp) a chce ho zkontrolovat, otestovat „projet kolem“ nebo posoudit podle brand booku Slon 4.0.
---

# Kontrola grafiky – Růžový slon

Výstup piš česky, stručně, pro člověka, který nepracuje v terminálu. Nic nikam neodesílej – jen zkontroluj a doporuč.

## 1. Získej vizuál
- Obrázek nebo PDF z chatu, Disku (download) nebo Basecampu (`basecamp files download <url> --out -`).
- Zjisti typ: **billboard / CLV**, **online banner**, **tiskovina do prodejny** (plakát, pult, výloha, kartička), **vkládka**, **foto na medailonek**. Když to není jasné, odhadni z rozměru a napiš, co jsi zvolil.
- U tiskových dat zkontroluj `pdfinfo` (rozměr, měřítko, ořezy), `pdffonts` (texty v křivkách = prázdný výpis) a `pdfimages -list` (rozlišení obrázků, cíl ≥ 150 dpi ve výsledné velikosti, u tisku z blízka 300 dpi).

## 2. Spusť simulaci
```
python3 .claude/skills/kontrola-grafiky/simulace.py <soubor> <scratchpad>/kontrola.png --typ billboard|banner|tisk|foto
```
(Pillow: použij venv, kde je nainstalovaný, nebo `python3 -m venv <scratchpad>/pilenv && <scratchpad>/pilenv/bin/pip install pillow`.)
Výsledek si prohlédni a pošli Tereze (SendUserFile, display render).

## 3. Kontrolní seznam

**A. Princip 3 prvků (Karel Novotný, 27. 11. 2026) – u reklamy povinné**
1. **Růžový slon** (značka) – čitelný i v simulaci z dálky / malé velikosti.
2. **Nabídka** (např. sleva 20 %) – čitelná.
3. **Erotický sortiment** (erotické pomůcky / dárky) – čitelný.
- Nic jiného nesmí mít větší důraz než tyto 3 prvky. Sdělení přímé a sebevědomé, ne básnické ani servilní.
- Maskot jen když posouvá příběh, ne „nalepený“.
- Billboard: max. ~7 slov, přečíst za 2–3 s. Reference: billboardy Alzy.

**B. Brand book Slon 4.0**
- Barvy: růžová #DC004E, tmavá fialová #240A49, krémová #FCEAEA, sekundární růžová #F29BA8, purpurová #7E3386, fuchsiová #B23291.
- Písma: Inter Tight (nadpisy), Roboto (text).
- Povinné kódy značky vždy: Název, Barva, Náboj (erotika), Diskrétnost; max. 7 kódů na výstup.
- **Jeden slon max. 1× na materiálu.**
- **Slovo „džin“ navenek nikdy** (ani „gin“).
- Název značky: „Růžový slon“ – pokud je v logu velké S, ověř s Terezou.

**C. Čitelnost a kontrast**
- Kontrast textu vůči pozadí (černobílá verze – text musí jasně oddělit od pozadí).
- Doporučení z testu 27. 11.: tmavé pozadí (#240A49) + bílý/světle růžový text funguje z dálky lépe než růžová na světle růžové; růžová na tmavě fialové je z dálky slabší než bílá.

**D. Technika (tisk)**
- Správný rozměr a měřítko (billboard 510 × 240 cm, data obvykle 1:10), spadávka/ořezy podle požadavku tiskárny.
- Texty v křivkách, obrázky v dostatečném rozlišení, barevný prostor dle tiskárny.

**E. Fotky na medailonky**
- Jednotný ořez (hlava a ramena, oči ve stejné výšce), stejné pozadí a barevnost jako ostatní medailonky, čtverec, ostrost, bez šumu.
- V malé velikosti (175 px a menší) musí být obličej rozpoznatelný.

**F. Právní a obsah**
- Platnost slevy/kódu sedí s termínem kampaně, žádná srovnávací tvrzení („nejlepší“) bez opory, ocenění jen jedno a srozumitelné.

## 4. Výstup pro Terezu
1. Obrázek simulace.
2. Tabulka: prvek | stav (✅ / ⚠️ / ❌) | poznámka – minimálně 3 prvky + kontrast + brand book + technika.
3. **Verdikt**: OK do tisku / drobné úpravy / předělat.
4. Max. 3 konkrétní úpravy pro grafika (Mirek), formulované tak, aby šly rovnou poslat.
5. Pokud hoří termín (tisk, nasazení), upozorni, dokdy je potřeba to vrátit grafikovi.
