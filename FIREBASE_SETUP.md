# 🔥 Firebase / Firestore Setup - Krok za krokem

Tento návod tě provede nastavením Firebase Firestore databáze pro aplikaci sledování konkurence.

## 📋 Co potřebuješ

- Google účet (ideálně firemní)
- 5-10 minut času
- Aplikaci již nasazenou na Netlify

---

## 🚀 Krok 1: Vytvoření Firebase projektu

### 1.1 Otevři Firebase Console
Jdi na: https://console.firebase.google.com/

### 1.2 Vytvoř nový projekt
1. Klikni na **"Add project"** (Přidat projekt)
2. Zadej název projektu: `konkurence-ruzovy-slon`
3. Klikni **"Continue"**

### 1.3 Google Analytics (volitelné)
- Pro tuto aplikaci **není potřeba**
- Můžeš vypnout: "Enable Google Analytics" → **OFF**
- Klikni **"Create project"**

### 1.4 Počkej na vytvoření
- Firebase vytvoří projekt (1-2 minuty)
- Klikni **"Continue"** když je hotovo

---

## 🌐 Krok 2: Registrace webové aplikace

### 2.1 Přidej Web App
1. V Firebase Console klikni na ikonu **"</>"** (Web)
2. Zadej název app: `Konkurence Tracker`
3. **NEZAŠKRTÁVEJ** "Also set up Firebase Hosting"
4. Klikni **"Register app"**

### 2.2 Zkopíruj konfiguraci
Firebase ti zobrazí konfigurační objekt, který vypadá takto:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "konkurence-ruzovy-slon.firebaseapp.com",
  projectId: "konkurence-ruzovy-slon",
  storageBucket: "konkurence-ruzovy-slon.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123def456"
};
```

### 2.3 Ulož konfiguraci
**DŮLEŽITÉ:** Tyto hodnoty budeš potřebovat v kroku 5!

Zkopíruj je do poznámkového bloku nebo si otevři GitHub.

---

## 📊 Krok 3: Aktivace Firestore Database

### 3.1 Otevři Firestore
1. V levém menu Firebase Console klikni na **"Build"** → **"Firestore Database"**
2. Klikni **"Create database"**

### 3.2 Vyber lokaci
1. Vyber **"Start in production mode"**
2. Klikni **"Next"**

### 3.3 Vyber umístění serveru
1. Doporučuji: **"eur3 (europe-west)"** (Frankfurt, Německo)
   - Nejblíže k ČR
   - Rychlejší odezva
2. Klikni **"Enable"**

### 3.4 Počkej na vytvoření
- Firestore se vytváří (1-2 minuty)
- Uvidíš prázdnou databázi

---

## 🔐 Krok 4: Nastavení Security Rules

### 4.1 Otevři Rules
1. V Firestore sekci klikni na záložku **"Rules"**

### 4.2 Nahraď výchozí pravidla
Vymaž vše a vlož tato pravidla:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Kolekce objednávek - všichni mohou číst a zapisovat
    match /orders/{orderId} {
      allow read, write: if true;
    }

    // Kolekce kampaní - všichni mohou číst a zapisovat
    match /campaigns/{campaignId} {
      allow read, write: if true;
    }

    // Kolekce nastavení - všichni mohou číst a zapisovat
    match /settings/{settingId} {
      allow read, write: if true;
    }
  }
}
```

### 4.3 Publish pravidla
Klikni **"Publish"**

⚠️ **Poznámka k bezpečnosti:**
- Tato pravidla umožňují **komukoliv** číst a zapisovat data
- Pro **internal tool** to je OK (aplikace není veřejná)
- Pokud chceš zabezpečení, můžeš přidat Firebase Authentication (viz Krok 7)

---

## 💻 Krok 5: Aktualizace konfigurace v aplikaci

### 5.1 Otevři GitHub repozitář
1. Jdi na: https://github.com/terezakucko-eng/terka
2. Přepni se na branch: `claude/competitor-order-tracker-1H0ek`

### 5.2 Edituj firebase-config.js
1. Najdi soubor `firebase-config.js`
2. Klikni na ikonu tužky (Edit)

### 5.3 Nahraď konfiguraci
Najdi tento blok:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

Nahraď ho svou konfigurací z kroku 2.2:

```javascript
const firebaseConfig = {
    apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXX",  // Tvoje hodnota
    authDomain: "konkurence-ruzovy-slon.firebaseapp.com",  // Tvoje hodnota
    projectId: "konkurence-ruzovy-slon",  // Tvoje hodnota
    storageBucket: "konkurence-ruzovy-slon.appspot.com",  // Tvoje hodnota
    messagingSenderId: "123456789012",  // Tvoje hodnota
    appId: "1:123456789012:web:abc123def456"  // Tvoje hodnota
};
```

### 5.4 Commit změny
1. Dolů scrolluj k "Commit changes"
2. Zadej commit message: `config: Přidání Firebase konfigurace`
3. Klikni **"Commit changes"**

---

## 🚀 Krok 6: Redeploy na Netlify

### 6.1 Automatický deployment
Pokud jsi nastavil/a GitHub Integration:
- Netlify automaticky detekuje změnu v GitHubu
- Spustí se nový build (1-2 minuty)
- Aplikace se aktualizuje s Firebase konfigurací

### 6.2 Manuální deployment (pokud jsi použil/a Netlify Drop)
1. Stáhni aktualizovaný repozitář z GitHubu
2. Přetáhni ho znovu na Netlify Drop

### 6.3 Ověření
1. Otevři aplikaci v prohlížeči
2. Otevři Developer Console (F12)
3. Měl/a bys vidět:
   ```
   🚀 Inicializace aplikace...
   ✅ Firebase úspěšně inicializován
   ✅ Firestore připojen - data budou sdílená
   ```

---

## ✅ Krok 7: Test Firestore

### 7.1 Přidej testovací objednávku
1. V aplikaci přejdi na "📊 Sledování objednávek"
2. Vyplň formulář:
   - Trh: CZ
   - Konkurent: Růžový Slon
   - Datum: dnes
   - Číslo objednávky: 123456
3. Klikni "Přidat záznam objednávky"

### 7.2 Zkontroluj v Firebase Console
1. Vrať se do Firebase Console
2. Firestore Database → Data
3. Měl/a bys vidět kolekci **"orders"** s 1 dokumentem

### 7.3 Test synchronizace
1. Otevři aplikaci v **jiném prohlížeči** (nebo incognito)
2. Měl/a bys vidět stejnou objednávku
3. ✅ Data jsou sdílená!

---

## 🔐 Krok 8: Zabezpečení (volitelné)

### Možnost A: Omezení na konkrétní domény
V Firebase Console:
1. **Project Settings** → **General**
2. Scrolluj dolů na "Your apps"
3. Vyber svou Web App
4. "App check" → Přidej svou Netlify doménu

### Možnost B: Firebase Authentication
Pokud chceš přihlašování:

1. **Authentication** → **Get started**
2. Vyber metodu: **Email/Password**
3. Updatuj Security Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Pouze přihlášení uživatelé mohou přistupovat k datům
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

4. V aplikaci přidej přihlašovací formulář

---

## 📊 Monitorování a údržba

### Sledování využití
Firebase Console → **Firestore Database** → **Usage**
- **Čtení/zápisy:** Kolik operací
- **Storage:** Kolik dat ukládáš
- **Bandwidth:** Přenesená data

### Free tier limity (měsíčně)
- ✅ 50,000 čtení
- ✅ 20,000 zápisů
- ✅ 20,000 smazání
- ✅ 1 GB úložiště

Pro tvoje použití to bude **více než dost**!

---

## 🆘 Řešení problémů

### Chyba: "Permission denied"
**Příčina:** Špatná Security Rules
**Řešení:** Zkontroluj pravidla v kroku 4

### Chyba: "Firebase: No Firebase App"
**Příčina:** Špatná konfigurace
**Řešení:** Zkontroluj firebase-config.js (Krok 5)

### Data se neukládají
1. Otevři Developer Console (F12)
2. Hledej červené chyby
3. Zkontroluj, že Firebase je inicializován:
   ```javascript
   console.log(firebase.apps.length); // Mělo by být > 0
   ```

### Aplikace používá LocalStorage místo Firestore
**Příčina:** Firebase se neinicializoval správně
**Řešení:**
1. Zkontroluj konzoli prohlížeče
2. Ověř firebase-config.js
3. Zkontroluj, že jsou načteny všechny Firebase skripty

---

## 📚 Další zdroje

- **Firebase dokumentace:** https://firebase.google.com/docs/firestore
- **Firestore ceny:** https://firebase.google.com/pricing
- **Security Rules:** https://firebase.google.com/docs/firestore/security/get-started

---

## ✅ Hotovo!

Máš plně funkční aplikaci s cloudovou databází! 🎉

Data se teď:
- ✅ Sdílí mezi všemi uživateli
- ✅ Synchronizují v reálném čase
- ✅ Zálohují automaticky
- ✅ Přístupná odkudkoliv

**Enjoy! 🚀**
