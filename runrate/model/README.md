# Model denní predikce tržeb

Model rozpočítá zbytek měsíce do dnů a odhadne konec měsíce. Do listu „Model váhy“ v runrate tabulce zapisuje parametry, ze kterých tabulka každý den sama přepočítá predikci.

## Jak to funguje

1. **Tvar měsíce** (`core.py`, `feats.py`). Ridge regrese na denní historii. Vysvětluje, jakou část měsíční tržby udělá který den. Bere v úvahu:
   - den v týdnu, dvě oddělené sady podle toho, jestli sklad expeduje i o víkendu (tržba je podle DUZP; s víkendovou expedicí se nedělní tržby už nepřelévají do pondělí);
   - den v měsíci (výplaty);
   - státní svátky a dohánění fakturace po nich;
   - Black Friday a Cyber Monday, Vánoce, Valentýn;
   - plán aktivit z denních targetů BI;
   - loňský průběh stejného měsíce.

   Novější data mají větší váhu. Malé trhy berou tvar z RS CZ + RS SK.
2. **Konec měsíce** se počítá v tabulce. Je to mix dvou odhadů:
   - tvar × MTD, tedy dosavadní tržby vydělené podílem uplynulých dnů. Dny s jednorázovou akcí (SMS, flash sale) se do tempa nepočítají, jinak by se jedna špička násobila do konce měsíce;
   - loni × růst, tedy loňské stejné dny v týdnu krát meziroční růst za 28 dní (jen RS CZ a RS SK).

   Váha tvaru roste s dnem v měsíci podle zpětného testu. K tomu se přičte úprava plánem spendu přes elasticitu.
   Nejistota σ je měřená mimo vzorek: váha tvaru se pro každý testovaný měsíc ladí jen na ostatních měsících.
3. **Zpětný test** (`backtest.py`, `combo.py`). Odhad konce měsíce ve 3., 7., …, 24. dni proti metodám A (MTD × křivka) a B (tempo 7 dní) na měsících od 7/2025. Mix s loňskem jde testovat až od 2/2026, kdy existuje loňsko po dnech; listopad s Black Friday ani období víkendové expedice v testu mixu zatím nejsou.

## Měsíční přepočet (při založení nového měsíce)

1. Z BI (stránka Custom date, křížový filtr divize) vyexportovat denní historii 1. 1. 2025 – včera. Pro každou divizi jeden soubor: Sales, Sales target, GM1, objednávky, návštěvy.
2. Data uložit do `data/` a spustit `build.py`. Vznikne `daily.pkl` (není v gitu).
3. Do `targets_month.json` dát denní targety nového měsíce z listu Křivky.
4. V `config.json` (není v gitu, vzor je `config.example.json`) zkontrolovat:
   - plán spendu;
   - období sobotní expedice.
5. Spustit `python3 backtest.py` a pak `python3 params.py RRRR-MM RRRR-MM-DD`.
6. Obsah `params_out.json` přepsat do listu „Model váhy“: váhy B4:J34, mix a nejistota L4:O34, spend S4:T12.
7. Pro prosinec srovnat Vánoce v listu „Loni po dnech“ (`loni.py`).

Repo je veřejné: data, čísla a odkazy na tabulku sem nepatří, jen kód.
