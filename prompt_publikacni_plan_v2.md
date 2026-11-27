# Prompt – Marketingový plán v2 (plánování + vyhodnocení), Růžový slon / Kondomshop / Flagranti

Zkopíruj celý text pod čarou do nové konverzace s Claudem (Claude Code s přístupem ke Google Disku, Basecampu, Gmailu a Targitu). Fáze 1 a 2 jsou návrh a stavba, fáze 3 je naplnění historie. Po každé fázi se zastav a ukaž mi výsledek.

---

## Kontext

Jsem Head of Marketing ve firmě Růžový slon s.r.o. Máme tři značky:
- **Růžový slon:** e-shopy CZ, SK, HU, RO, SI, HR, BG a prodejny.
- **Kondomshop:** CZ a SK.
- **Flagranti:** CZ a SK.

Dnes používáme nástroj https://rs-publikacni-plan.netlify.app/ (kalendář kampaní + roční publikační plán, filtry Status / Domény / Kanály, import a export CSV). Má tři slabiny:
1. umí jen plánovat, ne vyhodnotit (žádné plán × skutečnost),
2. má dva překrývající se formuláře (Kampaň a Záznam ročního plánu),
3. data nejsou sdílená ani dohledatelná. Nevím, kde leží, a nejde tam nahrát historii.

Chci nový nástroj, který bude **jednoduchý na obsluhu** (zvládne ho i kolegyně bez školení), **plánovací i vyhodnocovací**, a ve kterém bude **co nejvíc historie**, kterou dohledáme.

## Fáze 1 – Návrh (ukaž mi ho dřív, než začneš stavět)

Navrhni a ukaž:
- datový model,
- 3–4 obrazovky (jako jednoduché náčrty v textu),
- kde budou data uložená.

Drž se těchto zásad:

**1. Jeden typ záznamu = „Aktivita“.** Kampaň, příspěvek, NL, SMS, billboard, event i významný den jsou jedna entita. Liší se jen polem *Typ*. Žádné dva formuláře.

**2. Povinná pole (víc ne):** Název, Datum od, Značka a země (multivýběr), Kanál, Odpovědný.

**3. Volitelná pole:**
- Datum do, Typ, Téma nebo produkt, Sleva / mechanika, Slevový kód, Rozpočet, Popis.
- Odkazy: Basecamp, Disk, grafika, rodný list, Targito kampaň.

**4. Značky a země:**
- RS CZ, RS SK, RS HU, RS RO, RS SI, RS HR, RS BG, RS prodejny,
- KS CZ, KS SK,
- Flagranti CZ, Flagranti SK.

Každá značka má barvu a v pohledech jde zapnout a vypnout.

**5. Kanály ve skupinách.** Skupiny mají odpovídat našemu rozpočtu, aby šly náklady spárovat:
- **TV a video:** TV Nova, ONEPLAY, Markíza, kino
- **Rádio**
- **OOH:** billboardy, CLV
- **Performance:** Google Ads, Sklik, Heureka, Zboží, srovnávače, affiliate
- **Display:** Heureka bannery, Firmy.cz
- **CRM:** newsletter, SMS
- **Sociální sítě:** IG post / reels / stories, influenceři, TikTok, LinkedIn
- **Web:** HP banner, magazín / články, A/B testy, doprava zdarma
- **PR a spolupráce:** podcasty, články, partnerství
- **Eventy a prodejny**

**6. Stav jako jednoduchý průběh:** Nápad → V přípravě → Schváleno → Běží → Hotovo → Vyhodnoceno.

**7. Vyhodnocení u každé aktivity:** po skončení se otevře krátký blok „Výsledek“. Pole:
- Skutečný náklad
- Tržby (nebo tržby přes slevový kód)
- Počet objednávek
- Návštěvy
- U NL a SMS: open rate a CTR
- Hrubý zisk
- MKT profit 1 (= hrubý zisk − náklad), dopočítá se sám
- Hodnocení 1–5 hvězd
- „Co příště jinak“ (jedna věta)

Pole, která pro daný kanál nedávají smysl, se nezobrazují.

**8. Obrazovky:**
- **(a) Kalendář:** měsíc, týden a roční pás. Značky barevně, filtr značka / kanál / stav jedním klikem.
- **(b) Seznam:** tabulka s hledáním a exportem.
- **(c) Vyhodnocení:**
  - plán × skutečnost po měsících a značkách,
  - top a flop aktivity podle MKT profitu 1,
  - seznam „čeká na vyhodnocení“ (skončilo, výsledek chybí).
- **(d) Roční přehled:** významné dny, sezóny, akční kalendář (Valentýn, Black Friday, Vánoce, „šedesát devítky“ apod.), které se opakují každý rok.

**9. Uložení dat:** sdílená Google Tabulka jako databáze, ve které lidé můžou dělat drobné opravy i ručně. Aplikace data jen čte a zapisuje. Alternativu navrhni, jen pokud má jasnou výhodu. Bez hesel v kódu a bez localStorage jako jediného úložiště.

**10. UX:**
- Nová aktivita se dá založit do 30 sekund.
- Duplikovat loňskou aktivitu jedním klikem (posune datum o rok).
- Hromadné „Vyhodnotit“ pro aktivity, které skončily.
- Česky, bez zkratek.
- Destruktivní akce jen s potvrzením.

## Fáze 2 – Stavba

Postav nástroj podle schváleného návrhu a dej mi odkaz.

Struktura Google Tabulky (listy):
- Aktivity
- Výsledky
- Číselníky (značky, kanály, stavy, odpovědní)
- Roční kalendář
- Import – kontrola

Číselníky musím umět upravit sama v tabulce.

## Fáze 3 – Naplnění historie: VŠECHNY marketingové aktivity od 1. 1. 2024 do dnes

Cíl: v plánu mají být **všechny marketingové aktivity všech tří značek od roku 2024** (kampaně, akce a slevy, NL, SMS, TV, rádio, kino, OOH, display, influenceři, příspěvky, PR, spolupráce, eventy, prodejny). Projdi zdroje níže, **jen čti**. Nic neměň, nemaž, neodesílej. Každou nalezenou aktivitu zapiš do listu „Import – kontrola“ se zdrojem (odkaz) a jistotou údajů (vysoká / střední / nízká). Do ostrého listu „Aktivity“ ji přesuň až po mém schválení po skupinách. Duplicity (stejná aktivita z více zdrojů) slouč do jednoho řádku se všemi odkazy.

**Zdroje:**
1. **Basecamp** (účet 3317373):
   - projekt [MKT] Marketing (45674654): seznamy [MKT] - Požadavky na MKT, [MKT] - Spolupráce, [MKT] - OOH, [MKT] - TV kampaně, HEUREKA a zápisy ze schůzek,
   - projekt Brand Manual / SLON 4.0 (45681681),
   - projekt SonicBrand (49438825),
   - [LACO] - B2B,
   - FINANCE (36422922).

   Z to-do a zpráv vytáhni název, datum, značku, kanál, odpovědného a odkaz.
2. **Targito:**
   - seznam odeslaných kampaní (NL a automatizace) po značkách: datum, předmět, značka, počet odeslaných, open rate, CTR, tržby, pokud jsou,
   - SMS z profiSMS: datum, text, počet.
3. **Google Disk:**
   - 03 RS – Média: mediaplány, objednávky a postbuy TV, rádia, kina, Markízy,
   - 14 Outdoor (OOH): objednávky ploch po měsících,
   - 13 Grafika: bannery kampaní 2025 a 2026, každá složka = kampaň,
   - 07 Spolupráce, sponzoring a eventy,
   - 06 Sociální sítě, influenceři a PR: tabulka Influenceři 2026,
   - tabulka Vouchery SLEVOMAT 2026.
4. **Rozpočet a skutečnost:** tabulka Náklady MKT (11VPA42bACMskSDIadTqSIoQasbDlbnENPADdhLGlEJk), listy Náklady_MKT_2026_TERKA (Skutečnost po měsících a řádcích) a Náklady_MKT_2027. Odtud vezmi skutečné náklady k aktivitám, kde to jde přiřadit (TV, rádio, OOH, Heureka, influenceři), a plán 2027 jako kostru plánovaných aktivit.
5. **Gmail:** objednávky a potvrzení kampaní (štítky TV Nova, TV Markíza, RADIO - NeoMedia, Outdoor, HEUREKA, Spolupráce, SLEVOMAT, Seznam) jen pro doplnění dat a nákladů, které jinde chybí.
6. **Výsledky:** pokud existují exporty z Power BI (tržby a objednávky po kanálech a měsících) nebo tabulka slevových kódů, napáruj tržby přes kódy a období. Co nejde spárovat spolehlivě, nech prázdné a označ „k doplnění“. Čísla si nevymýšlej.

Pracuj po zdrojích a letech (2024, 2025, 2026). Po každém zdroji mi napiš stručný stav, ať vidím průběh.

**Na konci fáze 3 mi napiš:**
- kolik aktivit jsi našel po značkách, letech a kanálech,
- kolik má náklad a kolik výsledek,
- seznam mezer (co v historii chybí a kde by to mohlo být),
- odkaz na tabulku.

## Pravidla

- Piš česky.
- Nic ven (maily, komentáře v Basecampu) neposílej bez mého schválení.
- Slovo „džin“ v ničem viditelném navenek nepoužívej.
- V buňkách tabulky žádné barvy kromě barev značek v aplikaci.
- Nuly nezobrazuj (prázdná buňka).
