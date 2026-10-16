# Kondomedie: celostránková inzerce v programu

Autor: Tereza Kucková, Head of Marketing · Datum: 7. 10. 2026 · Stav: tiskové PDF hotové, čeká na schválení a technickou kontrolu divadla

## Kontext

- Růžový slon je partnerem nové inscenace Kondomedie. Premiéra 24. 10. 2026, 36 repríz, zhruba 12 000 diváků.
- Hra se odehrává v továrně na kondomy a pracuje s osvětou a předsudky.
- Program je reprezentativní a diváci si ho opravdu prohlížejí.
- Máme jednu celou stranu A5 uvnitř programu. Zadní obálku připravuje divadlo.

## Proč to k nám patří

- Brand kód Poslání – Detabuizace.
- Co měníme: stud → uvolnění, ticho → otevřenější komunikace.

## Obsah strany

Hlavní sdělení vychází z manuálu Slon 4.0. Ostatní texty jsou schválené 7. 10. 2026.

| Prvek | Text | Zdroj |
|---|---|---|
| Logo | horizontální logo Růžový slon | visualbook, Loga |
| Nadpis | Proměňujeme přání ve skutečnost. | Brand Essence |
| Pointa | Po představení zábava nekončí! | schváleno |
| Spodní pruh, nadpis | Přídavek na doma. | schváleno |
| Spodní pruh, text | Speciální nabídka pro návštěvníky Divadla Mír se skrývá v QR kódu. | schváleno |
| Výzva | Pojď si přát (ručně psané, šipka ke QR kódu) | schváleno |

- Výše slevy je jen v pusince, kterou drží Džin: −25 %. V textu ji neuvádíme.
- Webovou adresu neuvádíme, na nabídku vede QR kód.
- Výzva „Pojď si přát“ tyká, protože je to hravá ručně psaná poznámka. Ostatní texty jsou neutrální.

## Vizuál

- Džin s pusinkou −25 %. Pusinka jako akční štítek odpovídá manuálu („může sloužit jako akční label či cenovka“). Text v pusince je Inter Tight ExtraBold, stejný řez jako nadpis.
- Pozadí: gradient Bílá → Krémová. Za Džinem rozostřená pusinka v gradientu Růžová 20 → Purpurová 20, přesahuje do spadu.
- Spodní pruh Růžová 10 přes celou šířku stránky, do spadu.
- Písma: Inter Tight ExtraBold (nadpis, −25 %), Inter Tight Bold (pointa, „Přídavek na doma.“), Roboto Regular (text), Caveat Bold (ručně psaná výzva).
- Caveat není písmo z manuálu. Používáme ho jen pro jednu ručně psanou poznámku. (k potvrzení)

### Barvy pro tisk

| Barva | HEX | CMYK | Zdroj |
|---|---|---|---|
| Primární růžová | #DC004E | 0-100-50-5 | visualbook |
| Tmavá | #240A49 | 66-73-0-66 | visualbook |
| Krémová | #FCEAEA | 0-11-6-0 | visualbook |
| Růžová 10 | #FBE5ED | 0-14-3-0 | převod přes FOGRA39 (k potvrzení) |

- Pro Růžovou 10 manuál CMYK neuvádí. Oficiální CMYK růžové a krémové odpovídají převodu přes profil ISO Coated v2 (FOGRA39), proto je Růžová 10 převedená stejně. Pouhých 10 % růžové (0-10-5-0,5) by v tisku splynulo s krémovým pozadím.
- Pantone pro případný přímý tisk: růžová 1925 C, tmavá 275 C.

## QR kód

- Odkaz: https://hov.to/c918daf5 → https://www.ruzovyslon.cz/vlastni-produkty/?ref=kondomedie
- Zkracovací odkaz, cíl se dá změnit i po tisku.
- V tiskovém PDF je QR vektorový, barva Tmavá, bez bílého podkladu (průhledný na Růžové 10). Uprostřed je oficiální symbol v pusince, oprava chyb úrovně H.
- Velikost 29,7 × 29,7 mm (požadavek divadla: aspoň 20 × 20 mm), modul 1,03 mm, klidová zóna 2 moduly. Šipka do klidové zóny nezasahuje.
- Načtení je ověřené na náhledu tiskového PDF. Před tiskem otestovat na nátisku telefonem.

## Tiskové podklady

Soubor: `kondomedie-program/Kondomedie_RuzovySlon_A5_tisk_CMYK.pdf`, náhled `kondomedie-program/nahled.png`.

| Požadavek divadla | Stav v PDF |
|---|---|
| A5 148 × 210 mm, spadávka 3 mm (154 × 216 mm) | splněno, TrimBox a BleedBox nastavené, bez ořezových značek |
| důležité prvky aspoň 5 mm od ořezu | splněno, nejblíž je ručně psaná výzva (asi 7,7 mm od spodního ořezu) |
| tiskové PDF, CMYK | splněno, vektorové prvky v oficiálních CMYK, obrázky převedené do ISO Coated v2 (FOGRA39) |
| 300 dpi | splněno, rozostřená pusinka 300 dpi, Džin 530 dpi |
| písma v křivkách | splněno, PDF neobsahuje žádné písmo |
| QR kód aspoň 20 × 20 mm | splněno, 29,7 × 29,7 mm |

- Zdrojový obrázek Džina s pusinkou má 1000 × 1000 px. Pro tisk je zvětšený na 2000 px, aby text v pusince byl ostrý. Pokud existuje vektor nebo větší podklad od ilustrátora, kresba Džina bude v tisku ještě o něco ostřejší. [doplnit]
- Spodní blok (pruh, nabídka, QR, výzva) je proti původnímu návrhu posunutý o 3 mm výš, aby splnil bezpečnou zónu 5 mm. Džin a rozostřená pusinka se posunuly s ním.
- PDF se generuje ze zdrojů ve složce `kondomedie-program/zdroj/` příkazem `sh zdroj/make_print.sh`. Skript zároveň zkontroluje bezpečnou zónu a vypíše rozlišení obrázků.

## Soubory návrhu

- Tiskové PDF je hlavní podklad pro tisk.
- Canva (https://www.canva.com/d/qmSEQbVI0AYGCen) je upravitelná verze se stejným rozvržením. Písma v Canvě je potřeba ručně přepnout na Inter Tight a Roboto. Poslední úpravy čekají na uložení.
- Figma (https://www.figma.com/design/cHp432B8lKIKJKSrQcAJb7) slouží jako skica rozvržení. Používá Inter místo Inter Tight a spodní blok v ní ještě není posunutý kvůli bezpečné zóně.

## Zadní obálka (divadlo)

- Poslat divadlu oficiální logo z visualbooku (barevné na světlé pozadí, bílé na tmavé).
- Vyžádat náhled ke schválení před tiskem.

## Otevřené body

- Projeví se sleva −25 % po načtení QR? Cílová stránka zatím Kondomedii ani slevu nezmiňuje. [doplnit]
- Platí sleva jen na vlastní (Sloní) produkty? (k potvrzení)
- Platnost slevy. [doplnit]
- Papír a barevný profil od tiskárny. PDF počítá s natíraným papírem (FOGRA39). Pokud bude program na nenatíraném papíře, převedeme obrázky na jiný profil. [doplnit]
- Termín dodání podkladů divadlu. [doplnit]
