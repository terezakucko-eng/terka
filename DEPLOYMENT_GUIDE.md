# 🚀 Návod na deployment aplikace na Netlify

## Varianta A: Netlify Drop (rychlé, jednorázové)

### Kroky:
1. Stáhni soubor `konkurence-tracker.zip` z tohoto projektu
2. Otevři https://app.netlify.com/drop
3. Přihlaš se:
   - Email: tereza.kucko@gmail.com
   - Heslo: [tvoje heslo]
4. Přetáhni ZIP soubor do okna prohlížeče
5. Hotovo! Netlify ti dá URL typu: https://random-name-123.netlify.app

### Výhody:
- ✅ Rychlé (2 minuty)
- ✅ Žádná konfigurace

### Nevýhody:
- ❌ Při každé změně kódu musíš nahrát znovu

---

## Varianta B: GitHub Integration (doporučeno)

### Kroky:

#### 1. Přihlášení na Netlify
1. Jdi na https://app.netlify.com/
2. Přihlaš se pomocí:
   - Email: tereza.kucko@gmail.com
   - Heslo: [tvoje heslo]

#### 2. Přidání nového site
1. Klikni na **"Add new site"**
2. Vyber **"Import an existing project"**
3. Vyber **"Deploy with GitHub"**
4. Autorizuj Netlify přístup k GitHubu
5. Vyber repozitář: **`terezakucko-eng/terka`**

#### 3. Nastavení buildu
```
Branch to deploy: claude/competitor-order-tracker-1H0ek
Build command: (nechej prázdné)
Publish directory: .
```

#### 4. Deploy
1. Klikni **"Deploy site"**
2. Počkej 1-2 minuty
3. Site je živý! 🎉

### Výhody:
- ✅ Automatické deploymenty při každém git push
- ✅ Předchozí verze jsou dostupné (rollback)
- ✅ Preview deployments pro každý commit

### Nevýhody:
- ❌ Trochu delší nastavení (poprvé ~5 minut)

---

## Varianta C: Netlify CLI (pro pokročilé)

### Instalace Netlify CLI:
```bash
npm install -g netlify-cli
```

### Přihlášení:
```bash
netlify login
```
(Otevře se prohlížeč pro autentizaci)

### Deployment:
```bash
# V adresáři projektu
cd /home/user/terka

# První deployment
netlify deploy

# Production deployment
netlify deploy --prod
```

---

## 🔧 Po deploymentu

### Změna názvu site:
1. V Netlify jdi na **Site settings**
2. **Site details** → **Change site name**
3. Zadej např. `konkurence-ruzovy-slon`
4. URL: https://konkurence-ruzovy-slon.netlify.app

### Vlastní doména:
1. V Netlify jdi na **Domain settings**
2. **Add custom domain**
3. Zadej svou doménu (např. konkurence.ruzovyslon.cz)
4. Postupuj podle instrukcí pro DNS nastavení

---

## 🔐 Bezpečnostní doporučení

⚠️ **DŮLEŽITÉ:** Po dokončení deploymentu doporučuji změnit heslo k Netlify účtu:
1. Jdi na https://app.netlify.com/user/settings#profile
2. **Security** → **Change password**
3. Použij silné, unikátní heslo

Hesla by se nikdy neměla sdílet v plain textu!

---

## 📊 Testování aplikace

Po deploymentu otestuj:
1. ✅ Otevření aplikace v prohlížeči
2. ✅ Přidání testovací objednávky
3. ✅ Import z Google Sheets (s URL tvé tabulky)
4. ✅ Export do JSON
5. ✅ Přidání MKT kampaně
6. ✅ Zobrazení grafů

---

## 🆘 Řešení problémů

### "Page not found" chyba:
- Zkontroluj, že `Publish directory` je nastaveno na `.` (tečka)

### Aplikace se nenačítá:
- Zkontroluj konzoli prohlížeče (F12)
- Ověř, že všechny soubory byly nahrány

### Import z Google Sheets nefunguje:
- Zkontroluj, že tabulka je **veřejně přístupná**
- Ověř, že listy mají správný název (`Zkušeb.obj. CZ`, atd.)

---

**Vytvořeno pro Růžový Slon 🌸🐘**
