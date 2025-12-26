# 📊 Multi-Sheet Import - Návod

## 🎯 Co je nového?

Aplikace nyní podporuje **import z více listů Google Sheets** s různými datovými strukturami. Můžeš importovat data z týdenních i měsíčních přehledů pro CZ, SK a další trhy.

---

## 📋 Podporované listy

Aplikace umí importovat z těchto listů:

1. **Zkušeb.obj.CZ-týden** - Týdenní data z českého trhu
2. **Zkušeb.obj.SK-týden** - Týdenní data ze slovenského trhu
3. **Zkušeb.obj.CZ-měs** - Měsíční data z českého trhu
4. **Zkušeb.obj.SK-měs** - Měsíční data ze slovenského trhu
5. **Zkušeb.obj.RO,HU,PL atd-měs** - Měsíční data z ostatních trhů (Rumunsko, Maďarsko, Polsko)

---

## 🔄 Dual Import Logic - Dva typy sloupců

Aplikace rozpoznává **dva typy sloupců** a s každým pracuje jinak:

### ✅ **Konkurenční e-shopy** (Absolutní čísla)

Pro konkurenty importuje **číslo objednávky** a automaticky vypočítá **deltu** mezi měřeními.

**Příklad:**
```
Hopnato.cz:
  15.1: 2300500
  22.1: 2300800

  → Delta: 800 - 500 = 300 objednávek
```

**Konkurenti:**
- Hopnato.cz
- erosstar.cz
- deeplove.cz
- yoo.cz
- sexicekshop.cz
- honitka.cz
- sexshop.cz
- eroticke-pomucky.cz
- flagranti.cz
- sexshopik.cz
- sex-shop69.cz
- eroticcity.cz
- kondomshop.cz

---

### ⚠️ **Vlastní e-shopy** (Delty přímo)

Pro vlastní e-shopy importuje **sloupec "Objednáno kusů"**, který už obsahuje vypočítané delty.

**Příklad:**
```
Růžový Slon - Objednáno kusů:
  15.1: 19234
  22.1: 21456

  → Importuje přímo: 19234, 21456 (už jsou to delty!)
```

**Vlastní e-shopy:**
- **Růžový Slon** (ruzovyslon.cz)
- **Sexy Elephant** (sexyelephant.cz)
- **e-kondomy.cz** (e-kondomy.cz)

---

## 🚀 Jak na import

### 1. **Otevři správu dat**

Klikni na **"⚙️ Správa dat"** v aplikaci.

### 2. **Vyber list k importu**

V dropdown menu vyber jeden z těchto listů:
- **Zkušeb.obj.CZ-týden** (CZ - týdenní)
- **Zkušeb.obj.SK-týden** (SK - týdenní)
- **Zkušeb.obj.CZ-měs** (CZ - měsíční)
- **Zkušeb.obj.SK-měs** (SK - měsíční)
- **Zkušeb.obj.RO,HU,PL atd-měs** (ostatní trhy)

### 3. **Zadej URL Google Sheets**

URL je předvyplněná, pokud používáš jinou tabulku, uprav ji.

### 4. **Klikni na "Importovat"**

Aplikace automaticky:
1. Načte data z vybraného listu
2. Detekuje sloupce konkurentů (absolutní čísla)
3. Detekuje sloupce "Objednáno kusů" (delty)
4. Importuje data podle typu sloupce
5. Vypočítá delty pro konkurenty
6. Zobrazí výsledek

---

## 🔍 Jak aplikace detekuje sloupce?

### Detekce "Objednáno kusů":

Aplikace hledá sloupce obsahující:
- `"Objednáno kusů"`
- `"Objednano kusu"` (bez diakritiky)
- `"Obj. kusů"`
- `"Obj. kusu"`

A v názvu sloupce hledá:
- **Růžový Slon**: `"růžový slon"`, `"ruzovy slon"`, `"r.slon"`, `"rslon"`
- **Sexy Elephant**: `"sexy elephant"`, `"sexyelephant"`, `"s.elephant"`
- **e-kondomy.cz**: `"e-kondomy"`, `"ekondomy"`, `"e-kond"`

### Detekce konkurentů:

Aplikace hledá sloupce obsahující názvy konkurentů (např. `"hopnato"`, `"erosstar"`, `"deeplove"`, atd.)

---

## 📊 Co se stane po importu?

Po úspěšném importu uvidíš zprávu:

```
✅ Úspěšně importováno 52 záznamů!
📊 Konkurenti: 12 e-shopů (absolutní čísla)
🏪 Vlastní e-shopy: 3 e-shopů (delty z "Objednáno kusů")
```

Aplikace ti řekne:
- Kolik záznamů bylo importováno
- Kolik konkurentů bylo detekováno
- Kolik vlastních e-shopů bylo detekováno

---

## 🎨 Jak to vypadá v tabulce?

**Konkurenti** (erosstar.cz):
```
31.1.2024
  124011015      ← Číslo objednávky (absolutní)
  +1015          ← Delta (vypočítána automaticky)
```

**Vlastní e-shopy** (Růžový Slon):
```
31.1.2024
  0              ← Číslo objednávky (nepoužívá se)
  +19234         ← Delta (importovaná z "Objednáno kusů")
```

---

## 🐛 Řešení problémů

### Import nenašel žádné sloupce

**Problém:** `🎯 Nalezené sloupce: 0`

**Řešení:**
1. Otevři Developer Console (F12) → záložka **Console**
2. Zkontroluj, jaké sloupce aplikace načetla:
   ```
   📋 Načtených sloupců: 20
   📋 První sloupce: Datum | Hopnato.cz | erosstar.cz | ...
   ```
3. Ujisti se, že názvy sloupců odpovídají očekávaným názvům (viz sekce "Detekce sloupců")

### Import nenašel "Objednáno kusů" pro vlastní e-shopy

**Problém:** `🏪 Vlastní e-shopy: 0 e-shopů`

**Řešení:**
1. Zkontroluj, že sloupce mají název **"Objednáno kusů [název e-shopu]"**
2. Například: `"Objednáno kusů Růžový Slon"` nebo `"Obj. kusů R.Slon"`
3. Aplikace detekuje různé variace (s diakritkou i bez)

### Data se neimportují správně

**Problém:** Čísla jsou špatně nebo chybí

**Řešení:**
1. Zkontroluj formát dat v Google Sheets:
   - První sloupec = **Datum**
   - Další sloupce = **Čísla objednávek nebo delty**
2. Ujisti se, že tabulka je **veřejně přístupná** ("Kdokoliv s odkazem")
3. Zkontroluj, že jsi vybral správný list

---

## 💡 Tipy

1. **Importuj postupně** - Nejprve vyzkoušej import jednoho listu (např. CZ-týden)
2. **Kontroluj konzoli** - Developer Console (F12) ti ukáže detailní informace o importu
3. **Delty pro vlastní e-shopy jsou finální** - Aplikace je nepřepočítává, importuje přímo
4. **Konkurence se počítá automaticky** - Aplikace vypočítá delty mezi měřeními

---

## 📞 Shrnutí

✅ **Hotovo:**
- Import z 5 různých listů
- Detekce sloupců "Objednáno kusů" pro vlastní e-shopy
- Automatický výpočet delt pro konkurenty
- Flexibilní detekce názvů sloupců (s i bez diakritiky)
- Detailní zpětná vazba při importu

🔜 **Příště:**
- Multi-market podpora (různé trhy v různých záložkách)
- Spojování dat z více listů najednou
- Export zpět do Google Sheets

---

**Máš otázky? Otevři Developer Console (F12) pro detailní debugging info! 🔍**
