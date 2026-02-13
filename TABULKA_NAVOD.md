# 📊 Implementace přehledné tabulky sledování objednávek

## 🎯 Co máme

Z vašich Excel tabulek jsem zjistil strukturu dat:

### CZ - Měsíční sledování
- **Datum** (např. 31.1.2024)
- **Čísla objednávek** pro každého konkurenta:
  - ruzovyslon.cz, sexshop.cz, e-kondomy.cz, flagranti.cz, atd.
- **Automaticky vypočítané delty** (počet objednávek od posledního měření)
- **Agregované metriky**:
  - Celkem objednávek
  - Slon podíl trhu
  - Slon podíl z jednotlivých konkurentů

### SK - Týdenní sledování
- Stejná struktura, ale data se aktualizují týdně

## 📝 Co je potřeba udělat

### ✅ Hotovo (v souborech):
1. `tracking-data.js` - Datový model a import z Google Sheets
2. `order-tracking-ui.js` - UI komponenty pro tabulku
3. `firebase-config.js`, `firestore-integration.js` - Databáze

### 🔨 Co zbývá doděl

at:

#### 1. Aktualizovat `index.html`
Je potřeba přidat:
- Přehlednou tabulku s horizontálním scrollem
- Sticky sloupec pro datum
- Barevné zvýraznění pro Růžový Slon
- Formulář pro přidání záznamu s poli pro všechny konkurenty

#### 2. Aktualizovat `app.js`
- Integrovat nové datové funkce
- Upravit grafy pro novou strukturu dat

#### 3. Nahrát scripty do HTML
```html
<script src="firebase-config.js"></script>
<script src="firestore-integration.js"></script>
<script src="tracking-data.js"></script>
<script src="order-tracking-ui.js"></script>
<script src="app.js"></script>
```

## 🚀 Doporučený postup

### Varianta A: Upravím existující aplikaci (doporučuji)
Mohu kompletně předělat stávající aplikaci tak, aby:
1. **Záložka "Sledování objednávek"** = přehledná tabulka podle vašich Excel dat
2. **Záložka "MKT kampaně"** = zůstane jak je
3. **Import z Google Sheets** = načte data přímo z vašich tabulek

### Varianta B: Vytvoříme novou aplikaci od základu
Začneme znovu s čistým projektem optimalizovaným pro tabulková data.

## 💡 Co potřebuji vědět

1. **Chcete sledovat CZ měsíčně + SK týdně v jedné aplikaci?**
   - Nebo jen CZ?

2. **Máte ještě další trhy kromě CZ a SK?**

3. **Chcete umožnit manuální přidávání záznamů?**
   - Nebo jen import z Google Sheets?

4. **Priorita: Tabulka nebo grafy?**
   - Můžu se zaměřit na přehlednou tabulku a pak přidat grafy

## 📊 Ukázka jak bude tabulka vypadat

```
┌────────────┬──────────────┬──────────────┬──────────────┬─────────────┐
│ Datum      │ Růžový Slon  │ Sexshop.cz   │ e-kondomy.cz │ Celkem      │
│ (sticky)   │ (zvýrazněný) │              │              │ objednávek  │
├────────────┼──────────────┼──────────────┼──────────────┼─────────────┤
│ 31.1.2024  │ 1,706,741    │ 402,748      │ 277,572      │ 2,820,231   │
│            │ +19,234      │ +3,719       │ +1,067       │             │
├────────────┼──────────────┼──────────────┼──────────────┼─────────────┤
│ 29.2.2024  │ 1,709,247    │ 406,778      │ 278,492      │ 2,837,900   │
│            │ +2,506       │ +4,030       │ +920         │             │
└────────────┴──────────────┴──────────────┴──────────────┴─────────────┘
                    (horizontální scroll) →
```

## 🎨 Design prvky

- ✅ **Sticky levý sloupec** (Datum) - vždy viditelný při scrollu
- ✅ **Barevné zvýraznění** Růžového Slona
- ✅ **Zelené/červené delty** podle růstu/poklesu
- ✅ **Responzivní** - funguje na mobilu i desktopu
- ✅ **Filtrovatelné** - např. zobrazit jen poslední 3 měsíce
- ✅ **Exportovatelné** - stáhnout jako Excel/CSV

---

**Řekněte mi, jak chcete pokračovat a já upravím aplikaci přesně podle vašich potřeb!** 🚀
