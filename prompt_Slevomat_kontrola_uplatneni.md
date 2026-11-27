# Prompt pro Clauda v Chromu – Slevomat 2385550: kontrola uplatnění voucherů

Zkopíruj celý text pod čarou do nové konverzace s Claudem v Chromu. Předtím se přihlas do administrace ruzovyslon.cz/admin a otevři tabulku „Vouchery SLEVOMAT 2026“.

---

Potřebuji zkontrolovat, které slevové kódy ze Slevomatu zákazníci uplatnili na e-shopu ruzovyslon.cz. **Pracuj jen se čtením.** V administraci nic neměň, nemaž, nedeaktivuj a neupravuj kódy ani objednávky. Do Google Tabulky zapisuj jen do nového listu, který založíš (bod 4). Ostatní listy neměň.

**Zdroj kódů:** Google Tabulka „Vouchery SLEVOMAT 2026“
https://docs.google.com/spreadsheets/d/1Eza_Z3aUNHmMbpgrdHqkVUcnsnbqbq0Ivj0QRn8DZ0s/edit
List „Stav uplatnění“: sloupec A = kód, B = hodnota (800 / 1200 / 2000 Kč), E = stav z 23. 10. 2026.

**Které kódy kontrolovat:** všechny, u kterých ve sloupci E **není** „ano“, tedy „ne“, „neomezený – nejde ověřit“ a „v adminu není“ (celkem asi 185 kódů). Kódy se stavem „ano“ jsou už vyúčtované, ty přeskoč. Výjimka: zkontroluj i BR12KL a 4E2ZZU (byly použité víckrát).

**Postup:**
1. V administraci otevři slevové kódy (promo-code/list) a u každého kódu zjisti aktuální počet použití.
2. Hlavně u kódů s neomezeným počtem použití (∞) dohledej **objednávky**, ve kterých byl kód použitý: v seznamu objednávek vyfiltruj podle slevového kódu (nebo ho zadej do hledání). U každé objednávky si zapiš číslo, datum, stav (zaplacená, stornovaná, vrácená) a hodnotu slevy.
3. Pokud kód v adminu nenajdeš, napiš „v adminu není“.
4. V tabulce založ nový list **„Kontrola 27. 11.“** se sloupci:
   - A Kód, B Hodnota, C Stav 23. 10. (opiš ze sloupce E), D Počet použití teď, E Číslo objednávky, F Datum objednávky, G Stav objednávky, H Poznámka.
   - Jeden řádek = jedno použití kódu. Pokud kód použitý nebyl, dej jeden řádek s počtem 0 a prázdnou objednávkou.
5. Pracuj po dávkách (třeba 30 kódů) a po každé dávce zapiš výsledek do listu, ať se nic neztratí.

**Výstup do chatu na konci:**
- Kolik kódů bylo použito **poprvé po 23. 10. 2026** (po hodnotách 800 / 1200 / 2000 Kč) a kolik celkem.
- Kolik použití bylo **po 15. 11. 2026** (to už je po platnosti voucherů).
- Kódy použité víckrát než jednou (kód + počet).
- Stornované nebo vrácené objednávky s kódem.
- Pokud něco nešlo (filtr objednávek podle kódu, oprávnění), napiš přesně, kde jsi skončil a co jsi viděl.
