# Prompt pro Clauda v Chromu – Power BI: brand denně 2025 vs 2026

Zkopíruj celý text pod čarou do nové konverzace s Claudem v Chromu.

---

Potřebuji z Power BI vytáhnout denní data o brandové návštěvnosti e-shopu Růžový slon CZ. Pracuj jen se čtením. Nic v reportu neukládej, nesdílej a neměň trvale (filtry nastav jen pro export).

**Kde:** Power BI report „Marketing / Google Analytics“:
https://app.powerbi.com/groups/me/apps/44b71cd3-f671-4188-a650-ad58ff34bd8a/reports/55d1c0d4-98d7-4af0-a7d9-df94ea364fb9
Pokud tam je stránka s volbou vlastního data („Custom date“), použij ji.

**Filtry:**
- e-shop / divize: **Růžový slon CZ** (jen CZ, bez SK, Kondomshopu a zahraničí);
- granularita: **po dnech**. Pokud po dnech nejde, tak po týdnech a napiš mi to.

**Období (obě stáhni):**
1. 1. 10. 2026 – 30. 11. 2026 (nebo do posledního dne, který v datech je)
2. 1. 10. 2025 – 30. 11. 2025

**Kanály (každý zvlášť):**
- Google ads brand
- Google organic brand (případně „Brand organic“)
- Seznam organic brand
- Seznam sklik brand
- Direct
- **Celkem za e-shop** (součet všech kanálů)

**Metriky ke každému dni a kanálu:**
- Sessions (Estimated, pokud je na výběr)
- Sales allocated (Kč)
- Sales estimated (Kč), pokud je v reportu
- Objednávky / transakce
- Náklady Ads (Kč), pokud jsou v reportu

**Výstup:**
Založ na mém Google Disku novou tabulku Google „PBI export – brand CZ denně 2025 vs 2026“ ve složce „05 Performance a online“. Data dej do jednoho listu „Data“, jeden řádek = jeden den × jeden kanál, sloupce:
`Rok | Datum | Kanál | Sessions | Sales allocated | Sales estimated | Objednávky | Náklady Ads`
Čísla zapiš jako čísla (bez „Kč“ a mezer). Pokud tabulku vytvořit nejde, vypiš data do chatu jako CSV se středníkem jako oddělovačem.

**Na konci mi napiš:**
- odkaz na tabulku;
- za jaké dny data jsou (první a poslední den v obou letech);
- které kanály nebo metriky v reportu nebyly a jak se tam jmenovaly podobné;
- kontrolu: součet Sales allocated „Celkem“ za říjen 2025 a za říjen 2026 (mělo by vyjít zhruba 16,0 mil. a 19,6 mil. Kč).

Nic neodesílej e-mailem a nikomu nesdílej.
