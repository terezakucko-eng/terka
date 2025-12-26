# ✅ Další kroky pro spuštění aplikace

## 🎯 Co je hotovo:
- ✅ Aplikace je připravena
- ✅ Firebase integrace je naimplementována
- ✅ Kód je na GitHubu (branch: `claude/competitor-order-tracker-1H0ek`)

---

## 📋 Co potřebuješ udělat teď (v tomto pořadí):

### 1️⃣ Nasazení na Netlify (10 minut)
📖 Návod: `QUICK_DEPLOY.md`

**Rychlé kroky:**
1. Otevři https://app.netlify.com/
2. Add new site → Import from GitHub
3. Vyber repozitář: `terezakucko-eng/terka`
4. Branch: `claude/competitor-order-tracker-1H0ek`
5. Deploy!

✅ **Výsledek:** Aplikace běží na URL typu `https://xyz.netlify.app`

---

### 2️⃣ Nastavení Firebase (15 minut)
📖 Návod: `FIREBASE_SETUP.md`

**Rychlé kroky:**
1. Jdi na https://console.firebase.google.com/
2. Vytvoř nový projekt: `konkurence-ruzovy-slon`
3. Aktivuj Firestore Database
4. Zkopíruj Firebase config
5. Uprav `firebase-config.js` na GitHubu s tvou konfigurací
6. Netlify automaticky redeploy

✅ **Výsledek:** Data se sdílí mezi všemi uživateli

---

### 3️⃣ Import dat z Google Sheets (5 minut)

**Předpoklady:**
- Tabulka je veřejně přístupná
- Listy se jmenují: `Zkušeb.obj. CZ`, `Zkušeb.obj. SK`, atd.

**Kroky:**
1. Otevři aplikaci na Netlify URL
2. Klikni "⚙️ Správa dat"
3. Vlož URL tabulky
4. Klikni "Importovat z Google Sheets"

✅ **Výsledek:** Historická data jsou importována

---

## 🔄 Alternativní pořadí (pokud chceš nejdřív testovat bez Firebase):

### Varianta A: Netlify BEZ Firebase
1. Deploy na Netlify (bez Firebase setup)
2. Aplikace použije LocalStorage
3. Přidej testovací data ručně
4. Vyzkoušej, že vše funguje
5. Pak přidej Firebase podle potřeby

### Varianta B: Lokální testování
1. Stáhni repozitář z GitHubu
2. Otevři `index.html` přímo v prohlížeči
3. Testuj aplikaci lokálně
4. Pak deploy na Netlify

---

## 📞 Potřebuješ pomoc?

### Pokud nevíš, jak na to:
- ❓ **Deploy na Netlify:** viz `QUICK_DEPLOY.md`
- ❓ **Firebase setup:** viz `FIREBASE_SETUP.md`
- ❓ **Import z Google Sheets:** napiš mi o strukturu tabulky

### Pokud něco nefunguje:
1. Otevři Developer Console (F12) v prohlížeči
2. Podívej se na chybové hlášky (červené texty)
3. Napiš mi co vidíš

---

## 🎯 Doporučené pořadí PRO TEBE:

```
1. Deploy na Netlify (QUICK_DEPLOY.md)
   ↓
2. Vyzkoušej aplikaci (přidej testovací data)
   ↓
3. Setup Firebase (FIREBASE_SETUP.md)
   ↓
4. Uprav firebase-config.js na GitHubu
   ↓
5. Počkej na redeploy (automatický)
   ↓
6. Import dat z Google Sheets
   ↓
7. ✅ HOTOVO!
```

---

## 📚 Soubory s dokumentací:

| Soubor | Pro co je |
|--------|-----------|
| `README.md` | Obecný přehled aplikace |
| `QUICK_DEPLOY.md` | ⭐ Jak nasadit na Netlify |
| `FIREBASE_SETUP.md` | ⭐ Jak nastavit Firebase |
| `DEPLOYMENT_GUIDE.md` | Detailní deployment guide |
| `TODO_NEXT.md` | 👈 Tento soubor (další kroky) |

---

**Začni s `QUICK_DEPLOY.md` a ozvi se, pokud budeš potřebovat pomoct!** 🚀
