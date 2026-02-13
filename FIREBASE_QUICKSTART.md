# 🔥 Firebase Live Sync - Rychlý návod

Aplikace je nyní připravena pro **živou synchronizaci dat v reálném čase** pomocí Firebase Firestore!

## 🎯 Co to znamená?

✅ Data se sdílí mezi všemi uživateli
✅ Změny se zobrazují okamžitě (bez refreshe)
✅ Funguje na všech zařízeních současně
✅ Automatické zálohování v cloudu

---

## 🚀 Jak to aktivovat (5 minut)

### Krok 1: Vytvoř Firebase projekt

1. **Otevři:** https://console.firebase.google.com/
2. **Klikni:** "Add project" (Přidat projekt)
3. **Zadej název:** `terka-tracking` (nebo jiný)
4. **Google Analytics:** Vypni (není potřeba)
5. **Klikni:** "Create project"

### Krok 2: Aktivuj Firestore

1. V levém menu: **"Build"** → **"Firestore Database"**
2. Klikni: **"Create database"**
3. Vyber: **"Start in production mode"**
4. Lokace: **"eur3 (europe-west)"** (nejblíže k ČR)
5. Klikni: **"Enable"**

### Krok 3: Nastav Security Rules

1. V Firestore sekci: záložka **"Rules"**
2. Vymaž vše a vlož:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /trackingData/{document} {
      allow read, write: if true;
    }
    match /campaigns/{document} {
      allow read, write: if true;
    }
  }
}
```

3. Klikni: **"Publish"**

⚠️ **Poznámka:** Tato pravidla umožňují přístup všem. Pro internal tool to je OK. Pro veřejnou aplikaci by bylo potřeba přidat autentizaci.

### Krok 4: Získej konfiguraci

1. V levém menu: **⚙️ Project Settings**
2. Scrolluj dolů na: **"Your apps"**
3. Klikni na ikonu **"</>"** (Web)
4. Zadej název: `Terka Tracking`
5. **NEZAŠKRTÁVEJ** Firebase Hosting
6. Klikni: **"Register app"**

Zobrazí se konfigurace ve formátu:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "terka-tracking.firebaseapp.com",
  projectId: "terka-tracking",
  storageBucket: "terka-tracking.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123def456"
};
```

**ZKOPÍRUJ VŠECHNY TYTO HODNOTY!**

### Krok 5: Vlož konfiguraci do aplikace

1. Otevři soubor: `firebase-config.js`
2. Nahraď řádky 6-13 svými hodnotami:

```javascript
const firebaseConfig = {
    apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXX",  // Tvoje hodnota z kroku 4
    authDomain: "terka-tracking.firebaseapp.com",  // Tvoje hodnota
    projectId: "terka-tracking",  // Tvoje hodnota
    storageBucket: "terka-tracking.appspot.com",  // Tvoje hodnota
    messagingSenderId: "123456789012",  // Tvoje hodnota
    appId: "1:123456789012:web:abc123def456"  // Tvoje hodnota
};
```

3. Ulož soubor

### Krok 6: Deploy

**Pokud používáš Netlify:**
- Git push automaticky spustí nový build
- Počkej 1-2 minuty na deployment

**Pokud používáš Netlify Drop:**
- Přetáhni aktualizované soubory na Netlify

### Krok 7: Ověření ✅

1. Otevři aplikaci v prohlížeči
2. Stiskni **F12** (Developer Console)
3. Hledej zprávy:

```
🚀 Inicializace aplikace...
✅ Firebase úspěšně inicializován
✅ Firestore připojen - data budou sdílená v reálném čase
👂 Realtime listeners aktivní
```

**Pokud vidíš tyto zprávy, funguje to! 🎉**

---

## 🧪 Test live synchronizace

1. Otevři aplikaci ve **dvou oknech** prohlížeče (nebo na dvou zařízeních)
2. V prvním okně: **Přidej záznam**
3. V druhém okně: **Záznam se objeví automaticky (bez refreshe)!**

---

## 🐛 Řešení problémů

### Chyba: "Permission denied"

**Příčina:** Security Rules nejsou nastaveny správně
**Řešení:** Zkontroluj Krok 3

### Chyba: "Firebase: No Firebase App"

**Příčina:** Špatná konfigurace
**Řešení:** Zkontroluj, že jsi správně zkopíroval všechny hodnoty v Kroku 5

### Data se neukládají

1. Otevři Developer Console (F12)
2. Hledej červené chyby
3. Zkontroluj, že konfigurace je správná
4. Ověř, že Security Rules jsou nastaveny

### Aplikace používá LocalStorage místo Firestore

**Příčina:** Firebase se neinicializoval
**Řešení:**
1. Zkontroluj konzoli v prohlížeči
2. Ověř firebase-config.js
3. Zkontroluj, že jsou načteny všechny Firebase skripty v index.html

---

## 💰 Náklady

Firebase má **velmi štědrý free tier**:

✅ 50,000 čtení/den (ZDARMA)
✅ 20,000 zápisů/den (ZDARMA)
✅ 1 GB storage (ZDARMA)

Pro tvoje použití (sledování ~50 e-shopů, pár uživatelů) to bude **100% ZDARMA**.

---

## 📊 Co se synchronizuje?

✅ **Tracking data** (objednávky konkurence)
✅ **MKT kampaně**
✅ V reálném čase bez refreshe

Když někdo:
- Přidá záznam → Všichni ho vidí okamžitě
- Upraví záznam → Aktualizuje se všem
- Smaže záznam → Zmizí všem

---

## 🎉 Hotovo!

Máš nyní plně funkční aplikaci s **live synchronizací dat**!

**Enjoy! 🚀**
