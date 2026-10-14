# Paměť – Tereza Kucková (Head of Marketing, Růžový slon s.r.o.)

Tento soubor je dlouhodobá paměť mezi relacemi. Na začátku každé relace si ho přečti a drž se ho.
Aktualizuj ho vždy, když se něco rozhodne. Poslední velká aktualizace: 14. 10. 2026.
**Na konci každé větší práce tento soubor sám (bez připomenutí) aktualizuj a pushni do větve claude/basecamp-clickup-integration-LRFe6** – Tereza si to výslovně přeje („nic z této konverzace nesmí být zapomenuto“). Rozhodnutí, odkazy, čísla a otevřené úkoly zapisuj sem.

## Komunikace a pravidla (VŽDY)
- Piš česky.
- **Každý text do Basecampu, mailu nebo jinam ven nejdřív ukaž v chatu a počkej na schválení** („potřebuji text před přidáním vždy nejdříve odsouhlasit zde“).
- Do tabulek Gabriela (HoM hodnocení apod.) nic nepiš – udělej kopii.
- Hesla/tokeny nikdy do Environment variables CCR (vidí je všichni).
- Tereza nepracuje v terminálu – vše vysvětlovat klikacími kroky.

## Nástroje
- **Basecamp CLI** (veřejné): `GOPATH=/tmp/gopath /usr/local/go/bin/go install github.com/basecamp/basecamp-cli/cmd/basecamp@latest`, `export PATH=/tmp/gopath/bin:$PATH`, přihlášení `basecamp auth login --device-code --no-browser` (Tereza schválí odkazem). Účet 3317373. Komentáře: `basecamp comments create <url> - < soubor.md` (Markdown, tabulky fungují, zmínky `@Jméno.Příjmení`).
- Google Sheets: locale cs_CZ → ve vzorcích oddělovač `;`.
- PDF faktury: `python3 -m venv pdfenv && ./pdfenv/bin/pip install pypdf` (systémový pypdf padá).

## Klíčové tabulky
- **Náklady MKT** `11VPA42bACMskSDIadTqSIoQasbDlbnENPADdhLGlEJk`
  - `Náklady_MKT_2026_TERKA` (gid 2141485398): měsíce po 4 sloupcích (YOY 2025, FP plán, MKT plán, Skutečnost); Říjen MKT plán = AU, Listopad = AY, Prosinec = BC. Srovnávače řádky 62–75.
  - `MKT_performance_ROI_2026` (gid 1877542992): bloky ROI po kanálech (tržby, sessions, GM1, náklady, ROI, PNO), 10–12/2026 = predikce.
  - `Schválené FA_TEREZA` (gid 407810010): evidence schválených faktur (někdy rozúčtováno i mimo MKT střediska → nemusí sedět s tabulkou nákladů).
  - `Náklady_MKT_2027_TERKA` (gid 1695981681): oficiální podklad 2027 pro Lenku – zatím nevyplněno z modelu.
- **Model 2027** `1ximRdjtVWt2ac2-9pgWJWB7VzNd0v0Rt81ZrNSHEahw` (listy Přehled, Model 2027, Zdroj 2026 = IMPORTRANGE nákladů 2026).
- Adam Bartnický: Data/plán e-shopů `1YnwmNwgG76sRGM9jVC18C2PmIPqcFQGGHm84gAaJBUE`; CZ_detail_channel `1KVoA_odxqySzsENH_yFk1-llROnWL7xWesUzcAsqzIA`; SK_detail_channel `1siSs1czgIWNT00OJ0KrKzHEccdbRxMkG1IpW4VJrBLc` (list Data = sessions Estimated + Sales allocated po kanálech a měsících).
- HoM hodnocení – kopie: `1xnVnZsPu5i09hA9bO8kKP_KqBWcFfCt5jBNdar_tXDU`.

## Metodika (dohodnuto)
- **Náklady brát z útraty v systémech** (Heureka přehled odečtů, Sklik, Arukereso, Srovname, Firmy.cz); **traffic a tržby z Power BI** (Sales allocated, sessions Estimated – BI dopočítává traffic bez cookie lišty).
- ROI = (tržby × GM1 − náklady) / náklady; PNO = náklady / tržby. GM1 = marže e-shopu v daném měsíci.
- Predikce = **baseline posledních 3 měsíců** × sezónnost e-shopu (plán Adama) × vliv změny rozpočtu.
- Kurzy: 25 Kč/€, 0,0625 Kč/Ft.
- Výkon se cílí na **MKT profit 1**, ne na PNO.

## Srovnávače a Seznam – zjištění 2026
- Seznam peněženka RS = Sklik (brand, SEA, display) + Zboží.cz (Sklik kampaň „Nákupy“) + Firmy.cz (~7,7–8 tis./měs.). Zboží.cz ROI ~+358 %, Sklik SEA ~+96 %, display bez tržeb, brand = ochrana značky.
- Heureka RS CZ ROI ~+178 %, RS SK ~+186 %, Kondomshop CZ ~+389 %, KS SK ~+460 %. Realistické panny a dámské soupravy na Heurece prodělávají → stáhnout.
- Kondomshop CZ/SK nemá měřicí kód konverzí Heureky; Srovname KS nemá propojení s GA4.
- RS Srovname nepoužívá. Arukereso HU ~+17 % (odhad), v září vypadl kredit – hlídat/automatické dobíjení. Zahraniční srovnávače BI nesleduje (Adam má přemapovat); přístupy k nim Tereza nemá.
- Heureka CZ 4/2026: 260 tis. = PPC výpadek doháněný brand kampaní (~200 tis. mimo PPC).
- Heureka Product Ads (privátní značka): CZ ~11 tis./měs., SK ~1 tis./měs.

## Rok 2026 – provedené úpravy
- Náklady 2026, říjen–prosinec: auta, leasing, školení = 0.
- MKT plán 10–12/2026 pro srovnávače zapsán v jednotkách dobití (žlutě označené buňky).
- Basecamp komentář s žádostí o rozpočet 518405 (10–12: 156 459 / 163 867 / 187 983) odeslán do todo „MKT | požadavek na změnu budgetu“ (36422922/todos/10259674263).

## Model 2027 – rozhodnutí (scénář D, MKT celkem ~77,5 mil.)
- Scénáře: A tempo 7–9/2026, B PNO 10 % (Lenka), C PNO 13 %, D cílový MKT profit 1 po trzích. Přepínač na listu Přehled.
- Metoda „Plán…“ ve sloupci E + měsíční částky ve žlutých sloupcích AK–AV; plánové řádky se neškálují koeficientem scénáře.
- Srovnávače + Seznam dle ROI a sezónnosti (celkem ~1,67 mil.), Srovname RS 0, zahraničí minimum.
- Czech On-line Expo 2/2027: stánek +105 tis., dárky +40 tis., cestovné +35 tis.
- Rezerva na předem neurčenou brandovou aktivitu: 100 tis./měs. (kategorie Brand).
- Prodejny: 4 % z obratu prodejen 2026 (1–9 skutečnost + 10–12 dle trendu 7–9/2026 vs 2025), rozpad po prodejnách ř. 236–243; bez Foodora/Wolt, Pikito a RS Eventy. Bratislava (otevřena 9/2026) s náběhem 125→200 tis./měs. Celkem ~996 tis.
- RS Eventy (Erofest duben, Colours of Ostrava červenec) jen jako náklady (řádky Konference, eventy = shodně s 2026), ne do tržeb.
- Radek Hudák 70 tis./měs., Karel Novotný 100 tis./měs., školení 5 tis./měs., Dotykačka ukončena, Email INT a Mamata/Merglevský ukončeno.
- Targito dle fixního klíče (viz níže).

## Targito – rozúčtování (platí, odsouhlaseno 14. 10. 2026)
Detail v `targito-rozuctovani.md`. Shrnutí: faktura 84 952 Kč/měs. (dodatek, limit 6 mil.) → **Slon + Kondomshop 62 992 (74,2 %), Flagranti 21 960 (25,8 %)**; uvnitř Slona dle objemu z faktury (KS ~4,6 %); nadlimit uvnitř faktury se nepřeúčtovává; služby dle řádků (Růžový slon / Safety First). Měsíční kontrola – kalendář 3. pracovní den v měsíci.

## Podklady od kolegů (zdroje pro plán 2027)
- **Adam Bartnický** (e-maily 13. 10. 2026: „při práci na budgetu hodně pracuji s AI, data beru z BI, záložka Marketing / Google Analytics“):
  - RS_Budget_Drivers / data plánu e-shopů: `1YnwmNwgG76sRGM9jVC18C2PmIPqcFQGGHm84gAaJBUE` (list Data: Traffic, Orders, Revenue, GP po byznysech a měsících 2024–2026, 10–12/2026 extrapolace; prodejny 2026 = 29,1 mil. vč. Foodora/eventy/Pikito)
  - CZ_detail_channel `1KVoA_odxqySzsENH_yFk1-llROnWL7xWesUzcAsqzIA`, SK_detail_channel `1siSs1czgIWNT00OJ0KrKzHEccdbRxMkG1IpW4VJrBLc`
  - Power BI: https://app.powerbi.com/groups/me/apps/44b71cd3-f671-4188-a650-ad58ff34bd8a/reports/55d1c0d4-98d7-4af0-a7d9-df94ea364fb9 (Marketing / Google Analytics; stránka „Custom date“ s filtrem data – obraty prodejen a divizí)
- **Lenka Stará** – FP 2027: `1-1Fd6hvhgqUKF_Z_5ax4GOFOqz6HPdr44yO0muAL9Y0` (tržby za služby 2027 9,33 mil. = celofiremní číslo). PNO pro scénář B = 10 % (od Lenky), aktuální PNO ~13 %.
- **Radek Hudák** – Google Ads „Performance Avengers“: `1rHMCXFygdJFRbG0Zoxw4mz9RUB_-h5__J-BcQk28eMg` (MTD modely 8/2026, 9/2026, 10/2026; cílí na MKT profit 1).
- **Honza Bezecný** – Sales FP 2027 příprava (CZ e-shop, bottom-up SKU × BO tier): `1mjL5yyib9N9Ke8o-BWkkWoWMqmj1Efr8eiDjTLxivr4` (v1.0 14. 9. 2026). Báze 2026 225,6 mil., FC 2027 239,8 mil. (+6,3 %), cíl top-down +15 % = 259,4 mil. (mezera 19,6 mil.). Růsty: CZ 6 %, SK 15 %, KS 40 %, HU 4 %, zahraničí 0 %. GM1 2027 65 %. **Úkol pro MKT (pozn. 3): dopočítat ztrátu tržeb z nefunkčních PPC** – rychlý odhad duben+květen 2026 ≈ 2,9 mil. Kč (duben ~1,5, květen ~1,4; Google Ads duben 185 tis. místo ~1,5 mil.).
- Kategorie produktů: `1vE34FTfGP_4m5IDpDGWBynz0QR7i0RMHejmBMoyWNY8`.
- Czech On-line Expo 2027 (3.–4. 2. 2027, PVA Letňany): ceník stánků `1V_QiuJsiawlBI7Uy7CjlnZHHwe2uaON2ODvcCZBmjwA`, kontakt Martin Matuška (martin@czechonlineexpo.cz).

## Historie práce (září–říjen 2026)
- **Rutiny (Claude Code Routines):** každý pátek – Brand Manual týdenní update (nové sekce vždy NAHORU do těla zprávy 45681681/messages/9701476737, nikdy jako komentář; + needle zelená) a příprava zápisu MKT týmové porady (porada v pondělí, příprava v pátek 15:55–16:00 do pondělní occurrence; trigger trig_014ZnpV8JMMRKgydg4mpayBB). Konektory Gmail/Kalendář se k rutinám přidávají ručně na claude.ai/code/routines.
- Basecamp: needles vyžadují HTML; URL opakované schůzky `.../schedule_entries/[ID]/occurrences/[YYYYMMDD]`; Google Chat přes Gmail MCP nejde (Tereza vkládá ručně).
- Vyřešeno 29. 9.–14. 10.: počty kategorií; odpověď ke slevovým kuponům do vkládky (todo 45671942/todos/9630497042 – „zatím nevíme, řešíme příští týden“); zpětná vazba Marketing 2.0 (22336994/todos/10143358640) + Q&A k YoY metrikám a ROI srovnávačů; Firmy.cz investice; úkoly po termínu a plánování do kalendáře; oprava Basecamp CLI; zápisy Google konzultace a TV Nova (Irena Hradilová); todo OnePlay test 11–12/2026 a OnePlay 2027 (todolist 45674654/todolists/10377076837); Emailgin/SmartEmailing – balík gelů, kondomů a 200 kuponů, předání koordinátorce Evě Bukovjan, řeší Aneta Zajdová (todolist 9526311136); Angry Beards × RS drop todo (označen Jan Bezecný, FYI Gabriel Kopeć, Ladislav Kažimír); report 09/2026 (dokument 31903273/documents/10379527514 podle vzoru 10272796096); Q3 hodnocení HoM (kopie tabulky, plnění 100 %, Q4 projekt „SonicBrand RS – výběr dodavatele a zvukové logo“: agentura do 31. 10., smlouva+brief do 15. 11., logo+earcon do 31. 12.) + needle; příprava schůzky s Karlem Novotným 14. 10.; model nákladů 2027.
- Meat Design (akce pro Beatu) – odmítnout: nemáme budget ani kapacity, ať osloví příště s předstihem.

## Otevřené úkoly
- Marže po zářijovém přecenění – promítnout do scénáře D? (čeká na rozhodnutí)
- Přepsat Model 2027 do `Náklady_MKT_2027_TERKA` (MKT plán 2027).
- Zpráva o Targito rozúčtování pro Kubu, Zuzku, Lenku, Gabriela (ukázat ke schválení).
- Heureka Product Ads CZ – je v přehledu odečtů, nebo se platí zvlášť?
- Plán marketingu 2027 přes stakeholdery (zápis s Karlem 21. 9. 2026): Majitel, Produkt, Finance, Sales (e-com + prodejny), HR, IT, Flagranti, privátní značka – vizualizovat.
- Komentář PROJEKTY 2027 (privátka Q1–Q4, retence Q1–Q2 Jan Tříska, AI rádce Q3–Q4 Jan Tříska, mechanika eventů) – neodesláno.
- Mirek: subtask grafika A5 do programu (todo 10313341463) – nepotvrzeno.
- Report 09/2026 (dokument 10379527514) – rozpracováno.
- Meat Design – odmítnutí (koncept), Angry Beards todo 10399020325 bez řešitele/termínu.
- Doporučení týmu: nasadit konverzní kód Heureky na Kondomshop, GA4 u Srovname, auto-dobíjení Arukereso, přemapovat zahraniční srovnávače v BI.
