# 📊 Sledování konkurence - Růžový Slon

Webová aplikace pro sledování objednávek a marketingových kampaní konkurence.

## ✨ Funkce

### 📈 Sledování objednávek
- **Týdenní sledování** čísla objednávek u konkurentů
- **Výpočet růstu** objednávek:
  - Mezitýdenní (Week-over-Week - WoW)
  - Meziměsíční (Month-over-Month - MoM)
  - Meziroční (Year-over-Year - YoY)
- **Porovnání s Růžovým Slonem** napříč všemi metrikami
- **Market Share analýza** - podíl na trhu
- **Interaktivní grafy** zobrazující trendy a porovnání
- **Multi-market podpora** - CZ, SK, HU, RO, SI, HR, BG, PL, AT, IT

### 📢 Sledování marketingových kampaní
- Evidence kampaní konkurence
- Sledování kanálů (Newsletter, PPC, Social Media, atd.)
- Screenshot dokumentace
- Časové rozmezí kampaní
- Statistiky aktivity konkurentů

### 💾 Správa dat
- **Import z Google Sheets** - automatický import historických dat
- **Export/Import JSON** - záloha a přenos dat
- **Export do CSV** - analýza v Excelu
- **LocalStorage** - automatické ukládání v prohlížeči

## 🚀 Deployment na Netlify

### Krok 1: Příprava
1. Ujistěte se, že máte účet na [Netlify](https://www.netlify.com/)
2. Ujistěte se, že máte účet na [GitHub](https://github.com/)

### Krok 2: Nahrání na GitHub
1. Vytvořte nový repozitář na GitHubu (např. `konkurence-tracker`)
2. V terminálu spusťte:
```bash
git add .
git commit -m "Initial commit - aplikace pro sledování konkurence"
git push -u origin claude/competitor-order-tracker-1H0ek
```

### Krok 3: Deployment na Netlify
1. Přihlaste se na [Netlify](https://app.netlify.com/)
2. Klikněte na **"Add new site"** → **"Import an existing project"**
3. Vyberte **GitHub** a autorizujte přístup
4. Vyberte repozitář `konkurence-tracker`
5. Nastavení buildu:
   - **Branch to deploy:** `claude/competitor-order-tracker-1H0ek` (nebo main)
   - **Build command:** nechte prázdné
   - **Publish directory:** `.` (tečka)
6. Klikněte na **"Deploy site"**

### Krok 4: Vlastní doména (volitelné)
1. V Netlify přejděte na **Site settings** → **Domain management**
2. Klikněte na **"Add custom domain"**
3. Zadejte svou doménu a postupujte podle instrukcí

## 📖 Jak používat aplikaci

### Import dat z Google Sheets

#### Příprava Google Sheets tabulky:
1. Otevřete vaši Google Sheets tabulku
2. Ujistěte se, že je **veřejně přístupná**:
   - Klikněte na "Sdílet" → "Změnit na 'Kdokoli s odkazem'"
   - Nastavte oprávnění na "Prohlížeč"

3. **Struktura listů** by měla být:
   - Názvy listů: `Zkušeb.obj. CZ`, `Zkušeb.obj. SK`, atd.
   - **Sloupce** (v tomto pořadí):
     - Datum (např. `15.1.2024` nebo `2024-01-15`)
     - Konkurent (např. `Růžový Slon`, `Sexshop.cz`)
     - Číslo objednávky (např. `123456`)
     - Poznámky (volitelné)

#### Import v aplikaci:
1. Otevřete aplikaci
2. Klikněte na tlačítko **"⚙️ Správa dat"** v pravém horním rohu
3. Vložte URL Google Sheets tabulky
4. Klikněte na **"Importovat z Google Sheets"**
5. Aplikace automaticky načte data ze všech listů `Zkušeb.obj.*`

### Přidání objednávky manuálně
1. Přejděte na záložku **"📊 Sledování objednávek"**
2. Vyplňte formulář:
   - Trh (např. CZ)
   - Konkurent
   - Datum sledování
   - Číslo objednávky
3. Klikněte na **"Přidat záznam objednávky"**

### Přidání marketingové kampaně
1. Přejděte na záložku **"📢 Sledování MKT kampaní"**
2. Vyplňte formulář:
   - Konkurent
   - Datum zjištění
   - Popis kampaně
   - Kanál (Newsletter, PPC, atd.)
   - URL screenshotu (volitelné)
3. Klikněte na **"Přidat kampaň"**

## 🔧 Technologie

- **Frontend:** HTML5, TailwindCSS
- **JavaScript:** Vanilla JS (žádné závislosti)
- **Grafy:** Chart.js
- **Hosting:** Netlify
- **Storage:** Browser LocalStorage

## 📝 Struktura projektu

```
terka/
├── index.html          # Hlavní HTML soubor
├── app.js              # JavaScript aplikační logika
├── netlify.toml        # Netlify konfigurace
└── README.md           # Dokumentace
```

## 🛠️ Lokální vývoj

Pro lokální testování:

```bash
# Spusťte jednoduchý HTTP server
python -m http.server 8000
# nebo
npx serve .
```

Potom otevřete v prohlížeči: `http://localhost:8000`

## 📊 Podporované trhy

- 🇨🇿 CZ (Česká republika)
- 🇸🇰 SK (Slovensko)
- 🇭🇺 HU (Maďarsko)
- 🇷🇴 RO (Rumunsko)
- 🇸🇮 SI (Slovinsko)
- 🇭🇷 HR (Chorvatsko)
- 🇧🇬 BG (Bulharsko)
- 🇵🇱 PL (Polsko)
- 🇦🇹 AT (Rakousko)
- 🇮🇹 IT (Itálie)

## ⚠️ Důležité poznámky

- Data jsou ukládána pouze v **prohlížeči** (LocalStorage)
- Doporučujeme **pravidelně zálohovat** data pomocí exportu do JSON
- Pro import z Google Sheets musí být tabulka **veřejně přístupná**
- Aplikace funguje **offline** po prvním načtení

## 🆘 Podpora

V případě problémů:
1. Zkontrolujte, zda je Google Sheets tabulka veřejně přístupná
2. Ověřte formát dat v tabulce
3. Zkontrolujte konzoli prohlížeče (F12) pro chybové zprávy
4. Zkuste vymazat cache prohlížeče a znovu načíst stránku

## 📄 Licence

© 2024 Růžový Slon - Internal tool

---

**Vytvořeno s ❤️ pro Růžový Slon**
