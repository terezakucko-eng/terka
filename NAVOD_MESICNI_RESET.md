# 📘 Návod: Měsíční reset pro erosstar.cz a deeplove.cz

## 🎯 Problém

Některé e-shopy (erosstar.cz, deeplove.cz) **resetují číselnou řadu každý měsíc**. To znamená, že na začátku každého měsíce začnou číslovat objednávky od začátku.

**Formát čísla objednávky:** `1YYMMSSSS`

```
124074452 = 1-24-07-4452
           ↓ ↓  ↓  ↓
           | |  |  └─ Pořadové číslo (4452. objednávka v měsíci)
           | |  └──── Měsíc (07 = červenec)
           | └─────── Rok (24 = 2024)
           └───────── Prefix (vždy 1)
```

---

## ✅ Normální případ (stejný měsíc)

Pokud měřím v rámci **stejného měsíce**, delta se počítá normálně:

**Příklad:**
```
15.7.2024: 124073000
22.7.2024: 124073500

Delta = 3500 - 3000 = 500 objednávek
```

✅ **Aplikace to počítá automaticky správně.**

---

## ⚠️ Speciální případ (změna měsíce)

Pokud měřím **přes změnu měsíce**, musím použít data z **měsíční tabulky**!

### Postup:

#### 1. **Najdi koncové číslo předchozího měsíce**

Otevři **měsíční tabulku** (Zkušeb.obj. měsíční) a najdi **poslední číslo z předchozího měsíce** (poslední den měsíce, např. 31.7).

**Příklad:**
```
31.7.2024: 124074452  ← Toto je koncové číslo července!
```

#### 2. **Zadej data do aplikace**

Při přidávání záznamu:

1. Zadej normální čísla objednávek pro všechny e-shopy
2. **Posuň se dolů** k sekci **"Změna měsíce (erosstar.cz & deeplove.cz)"**
3. Do pole **"erosstar.cz - Konec měsíce"** zadej **koncové číslo z měsíční tabulky** (např. `124074452`)
4. Totéž pro deeplove.cz pokud se u něj také měsíc mění

#### 3. **Aplikace spočítá správně**

Aplikace automaticky použije vzorec:

```
Delta = (konec_měsíce - předchozí_týdenní) + nový_měsíc

Příklad:
29.7: 124074122  (poslední týdenní měření v červenci)
31.7: 124074452  (konec měsíce z měsíční tabulky) ← TOTO ZADÁVÁŠ
5.8:  124080632  (první týdenní měření v srpnu)

Výpočet:
(4452 - 4122) + 632 = 330 + 632 = 962 objednávek ✅
```

---

## 🔍 Jak to vypadá v aplikaci

### **Formulář pro přidání záznamu:**

```
┌──────────────────────────────────────────────────────┐
│  Datum měření: 5.8.2024                              │
│  Poznámky: Změna měsíce                              │
├──────────────────────────────────────────────────────┤
│  Čísla objednávek konkurentů:                        │
│  ┌─────────────────────┬─────────────────────────┐   │
│  │ Hopnato.cz:   2300838 │ erosstar.cz: 124080632│   │
│  │ deeplove.cz: 225090027 │ ...                  │   │
│  └─────────────────────┴─────────────────────────┘   │
├──────────────────────────────────────────────────────┤
│  ⚠️ ZMĚNA MĚSÍCE (erosstar.cz & deeplove.cz)        │
│                                                      │
│  Pokud toto měření přechází do nového měsíce,       │
│  zadej koncové číslo z MĚSÍČNÍ TABULKY:             │
│                                                      │
│  erosstar.cz - Konec měsíce:  124074452             │
│  deeplove.cz - Konec měsíce:  225093130             │
│                                                      │
│  💡 Pouze pokud se mění měsíc!                      │
└──────────────────────────────────────────────────────┘
```

---

## 📊 Kdy je potřeba zadat koncové číslo?

### ✅ **ANO** - zadej koncové číslo:
- Měření **29.7 → 5.8** (přes změnu měsíce)
- Měření **31.8 → 7.9** (přes změnu měsíce)
- Měření **25.10 → 2.11** (přes změnu měsíce)

### ❌ **NE** - nechej pole prázdné:
- Měření **8.7 → 15.7** (stejný měsíc)
- Měření **22.8 → 29.8** (stejný měsíc)
- Měření **1.9 → 8.9** (stejný měsíc)

---

## 🚨 Co se stane, když nezadáš koncové číslo?

Aplikace **detekuje změnu měsíce** a:
1. Zobrazí **varování v konzoli** (F12 → Console)
2. Použije **zjednodušený výpočet** (jen číslo z nového měsíce)
3. Delta bude **NEÚPLNÁ** ⚠️

**Příklad nesprávného výpočtu:**
```
29.7: 124074122
5.8:  124080632

Bez koncového čísla: Delta = 632  ❌ (chybí objednávky z konce července!)
S koncovým číslem:   Delta = 962  ✅ (správně!)
```

---

## 💡 Tipy

1. **Vždy mějte po ruce měsíční tabulku** při zadávání dat přes změnu měsíce
2. **Konzole (F12)** vám ukáže upozornění, pokud detekuje změnu měsíce
3. Pole "Konec měsíce" **nechávejte prázdné** pokud se měsíc nemění
4. Data **můžete editovat později** - klikněte na ✏️ u záznamu a doplňte koncové číslo

---

## ❓ Často kladené otázky

### **Q: Kde najdu koncové číslo měsíce?**
A: V **měsíční tabulce** (Zkušeb.obj. měsíční) na posledním řádku předchozího měsíce (např. 31.7, 31.8, atd.)

### **Q: Musím to zadávat pro všechny e-shopy?**
A: **NE!** Pouze pro erosstar.cz a deeplove.cz. Ostatní e-shopy (Hopnato, sexshop.cz, atd.) nemají měsíční reset.

### **Q: Co když zapomenu zadat koncové číslo?**
A: Delta bude neúplná. Můžeš záznam **editovat** (klikni na ✏️) a doplnit koncové číslo. Delty se přepočítají automaticky.

### **Q: Kde vidím, že aplikace správně počítá?**
A: Otevři **Developer Console** (F12) → záložka **Console**. Uvidíš:
```
✅ erosstar.cz: Změna měsíce 07→08
   Výpočet: (4452 - 4122) + 632 = 962
```

---

## 🎉 Shrnutí

1. **Normální měření** (stejný měsíc) → nic speciálního, aplikace počítá sama
2. **Změna měsíce** → najdi koncové číslo v měsíční tabulce a zadej ho
3. **Aplikace automaticky** detekuje změnu a použije správný vzorec
4. **Vždy zkontroluj konzoli** (F12) pro potvrzení správného výpočtu

---

**Otázky? Problém?** Zkontroluj konzoli (F12) pro detailní výpis výpočtů! 🔍
