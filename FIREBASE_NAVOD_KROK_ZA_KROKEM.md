# 🔥 Firebase - Podrobný návod pro napojení živých dat

**Čas:** 10-15 minut
**Potřebuješ:** Google účet (stejný jako máš Gmail)
**Výsledek:** Data se budou sdílet živě mezi všemi, kdo aplikaci používají

---

## 📋 Co budeš dělat (ve zkratce)

1. Vytvoříš si "schránku" v cloudu pro data (Firebase projekt)
2. Zapneš v ní databázi (Firestore)
3. Nastavíš, kdo může data číst a měnit (Security Rules)
4. Dostaneš "klíče" k této schránce (Firebase credentials)
5. Dáš tyto klíče do aplikace
6. Nahraješ aplikaci na internet (Netlify)

Teď to projdeme velmi podrobně...

---

## 🌐 ČÁST 1: Vytvoření Firebase projektu

### Krok 1.1: Otevři Firebase Console

1. **Otevři prohlížeč** (Chrome, Firefox, Edge...)
2. **Zadej do adresního řádku:** `console.firebase.google.com`
3. **Stiskni Enter**
4. **Přihlaš se** Google účtem (pokud ještě nejsi přihlášená)

**Co uvidíš:**
- Hlavní stránku Firebase s nápisem "Welcome to Firebase"
- Velké tlačítko "Add project" nebo "Create a project"

---

### Krok 1.2: Klikni na "Add project"

1. **Najdi velké tlačítko** s nápisem **"Add project"** nebo **"Create a project"**
2. **Klikni na něj**

**Co se stane:**
- Otevře se formulář pro vytvoření nového projektu

---

### Krok 1.3: Zadej název projektu

1. **Uvidíš pole** "Project name" (Název projektu)
2. **Napiš do něj:** `terka-tracking`
   - Nebo jakýkoliv jiný název (například: `ruzovy-slon-objednavky`)
   - Můžeš použít jen písmena, čísla a pomlčky

3. **Pod polem** uvidíš ID projektu (automaticky se vyplní)
   - Vypadá nějak takto: `terka-tracking-a1b2c`
   - **NECH TAK JAK JE** - nepotřebuješ to měnit

4. **Zaškrtni checkbox** "I accept the Firebase terms"

5. **Klikni na modré tlačítko** **"Continue"**

**Co se stane:**
- Přejdeš na další obrazovku "Google Analytics"

---

### Krok 1.4: Vypni Google Analytics (není potřeba)

1. **Uvidíš otázku:** "Enable Google Analytics for this project?"
2. **Přepni přepínač** na **OFF** (šedá barva)
   - Analytics pro tuto aplikaci nepotřebuješ

3. **Klikni na modré tlačítko** **"Create project"**

**Co se stane:**
- Zobrazí se progress bar "Creating your project..."
- Počkej **1-2 minuty** (Firebase vytváří projekt)

---

### Krok 1.5: Počkej na dokončení

1. **Počkej**, dokud neuvidíš zprávu: **"Your new project is ready"**
2. **Klikni na tlačítko** **"Continue"**

**Co uvidíš:**
- Dashboard Firebase projektu (hlavní obrazovka s různými ikonami)

---

## 📊 ČÁST 2: Vytvoření Firestore databáze

### Krok 2.1: Otevři Firestore sekci

1. **V levém menu** (černá lišta vlevo) najdi sekci **"Build"**
2. **Klikni na "Build"** - rozbalí se seznam
3. **V seznamu klikni na:** **"Firestore Database"**

**Co uvidíš:**
- Stránku s tlačítkem "Create database"

---

### Krok 2.2: Klikni na "Create database"

1. **Klikni na velké tlačítko** **"Create database"**

**Co se stane:**
- Otevře se popup okno "Create database"

---

### Krok 2.3: Vyber "Production mode"

1. **V popup okně** uvidíš 2 možnosti:
   - **Production mode** (✅ tuhle vyber)
   - Test mode

2. **Klikni na radio button** vedle **"Start in production mode"**

3. **Klikni na tlačítko** **"Next"**

**Poznámka:** Produkční režim je bezpečnější - nastavíš pravidla ručně v dalším kroku

---

### Krok 2.4: Vyber lokaci serveru

1. **Uvidíš dropdown menu** "Cloud Firestore location"

2. **Klikni na dropdown** a vyber:
   - **"eur3 (europe-west)"**
   - Nebo **"europe-west1"**
   - Nebo **"europe-west3"**

**Proč to je důležité:**
- Server bude v Evropě (Frankfurt nebo Belgie)
- Data se budou načítat rychleji (blíže k ČR)

3. **Klikni na tlačítko** **"Enable"**

**Co se stane:**
- Progress bar "Creating your Cloud Firestore database..."
- Počkej **1-2 minuty**

---

### Krok 2.5: Počkej na vytvoření databáze

**Co uvidíš po dokončení:**
- Prázdnou databázi Firestore
- Několik záložek nahoře: "Data", "Rules", "Indexes", "Usage"

**Gratulace! Databáze je vytvořená!** ✅

---

## 🔐 ČÁST 3: Nastavení Security Rules (Pravidla přístupu)

### Krok 3.1: Přejdi na záložku "Rules"

1. **Najdi záložky** nahoře na stránce: Data | **Rules** | Indexes | Usage
2. **Klikni na záložku** **"Rules"**

**Co uvidíš:**
- Textové pole s kódem (něco jako programovací jazyk)
- Pravděpodobně tam bude napsáno něco jako:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

### Krok 3.2: Vymaž vše z textového pole

1. **Klikni do textového pole** s kódem
2. **Vyber všechno:** Stiskni **Ctrl+A** (na Windows) nebo **Cmd+A** (na Mac)
3. **Smaž:** Stiskni **Delete** nebo **Backspace**

**Teď máš prázdné pole!**

---

### Krok 3.3: Zkopíruj nová pravidla

1. **Tady jsou pravidla - ZKOPÍRUJ JE:**

```
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

2. **Jak zkopírovat:**
   - Vyber všechen text výše (od `rules_version` po poslední `}`)
   - Stiskni **Ctrl+C** (Windows) nebo **Cmd+C** (Mac)

---

### Krok 3.4: Vlož pravidla do Firebase

1. **Klikni do prázdného textového pole** v Firebase (záložka Rules)
2. **Vlož text:** Stiskni **Ctrl+V** (Windows) nebo **Cmd+V** (Mac)

**Co tam teď vidíš:**
- Zkopírovaná pravidla z předchozího kroku

---

### Krok 3.5: Uložení pravidel

1. **Najdi tlačítko** **"Publish"** (nahoře vpravo)
2. **Klikni na něj**

**Co se stane:**
- Zobrazí se popup "Publish rules?"
- Klikni **"Publish"**

**Co uvidíš:**
- Zelený banner "Rules published successfully"

**Pravidla jsou nastavená!** ✅

**Co ta pravidla znamenají (nemusíš rozumět, jen pro kontext):**
- `trackingData` = tvoje data objednávek
- `campaigns` = tvoje MKT kampaně
- `allow read, write: if true` = kdokoliv může číst a zapisovat
- Pro interní nástroj (jako je tenhle) je to v pořádku

---

## 🔑 ČÁST 4: Získání Firebase "klíčů" (credentials)

### Krok 4.1: Otevři nastavení projektu

1. **V levém menu** (černá lišta) **najdi ikonu ozubeného kola** ⚙️ (úplně nahoře vedle "Project Overview")
2. **Klikni na ikonu** ⚙️
3. **V rozbalovacím menu klikni na:** **"Project settings"**

**Co uvidíš:**
- Stránku s nastavením projektu
- Záložky: General | Service accounts | Usage and billing...

---

### Krok 4.2: Scrolluj dolů na "Your apps"

1. **Scrolluj dolů** na stránce, dokud neuvidíš sekci:
   - **"Your apps"**
   - Pod tím: "There are no apps in your project"

2. **Uvidíš několik ikon:**
   - iOS ikona (jablko)
   - Android ikona (Android robot)
   - **Web ikona:** `</>`

---

### Krok 4.3: Klikni na Web ikonu

1. **Klikni na ikonu** **`</>`** (vypadá jako HTML tag)

**Co se stane:**
- Otevře se popup "Add Firebase to your web app"

---

### Krok 4.4: Zaregistruj aplikaci

1. **V popup okně** uvidíš pole "App nickname"
2. **Napiš do něj:** `Terka Tracking App`
   - Nebo jakýkoliv jiný název

3. **Checkbox "Also set up Firebase Hosting":**
   - **NEZAŠKRTÁVEJ** (nech ho prázdný)
   - Hosting nepotřebuješ, máš už Netlify

4. **Klikni na tlačítko** **"Register app"**

**Co se stane:**
- Zobrazí se další obrazovka "Add Firebase SDK"

---

### Krok 4.5: Zkopíruj Firebase konfiguraci

**Co uvidíš:**
- Kód, který začína `const firebaseConfig = {`
- Několik řádků s hodnotami jako `apiKey`, `authDomain` atd.

**TENTO KÓD POTŘEBUJEŠ ZKOPÍROVAT!**

**Vypadá nějak takto:**
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "terka-tracking-a1b2c.firebaseapp.com",
  projectId: "terka-tracking-a1b2c",
  storageBucket: "terka-tracking-a1b2c.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

---

### Krok 4.6: Jak zkopírovat hodnoty

**Možnost A - Celý blok (jednodušší):**

1. **Vyber text** od `const firebaseConfig = {` po `};`
2. **Zkopíruj:** Ctrl+C (Windows) nebo Cmd+C (Mac)
3. **Ulož si to** do poznámkového bloku (Notepad) nebo Word dokumentu
   - Tyto hodnoty budeš potřebovat za chvíli!

**Možnost B - Po řádcích (pokud nefunguje celý blok):**

Otevři si **Poznámkový blok** (Notepad) nebo Word a **opiš si tyto hodnoty:**

```
apiKey: AIzaSyDXXXXXXXXXXXXXXXXXXXXXXX
authDomain: terka-tracking-a1b2c.firebaseapp.com
projectId: terka-tracking-a1b2c
storageBucket: terka-tracking-a1b2c.appspot.com
messagingSenderId: 123456789012
appId: 1:123456789012:web:abcdef123456
```

**DŮLEŽITÉ:** Tvoje hodnoty budou jiné než v příkladu! Zkopíruj ty SVOJE!

---

### Krok 4.7: Pokračuj ve Firebase

1. **Klikni na tlačítko** **"Continue to console"**

**Gratulace! Máš Firebase "klíče"!** ✅

---

## 💻 ČÁST 5: Vložení klíčů do aplikace

**POZOR:** Tato část vyžaduje editaci kódu. Neboj se, uděláme to jednoduše!

### Krok 5.1: Otevři GitHub

1. **Otevři novou záložku** v prohlížeči
2. **Zadej adresu:** `github.com/terezakucko-eng/terka`
3. **Přihlaš se** do GitHubu (pokud ještě nejsi)

**Co uvidíš:**
- Tvůj repozitář s kódem aplikace

---

### Krok 5.2: Přepni na správnou větev (branch)

1. **Najdi nahoře vlevo** tlačítko s nápisem `main` (nebo jiným názvem větve)
2. **Klikni na něj** - rozbalí se menu
3. **V menu vyber:** `claude/competitor-order-tracker-1H0ek`

**Co se stane:**
- GitHub přepne zobrazení na tuto větev

---

### Krok 5.3: Najdi soubor firebase-config.js

1. **V seznamu souborů** (uprostřed stránky) najdi soubor:
   - **`firebase-config.js`**

2. **Klikni na název souboru**

**Co uvidíš:**
- Obsah souboru s kódem
- Nahoře vpravo ikony: Raw | Blame | **Tužka** (Edit) | Koš (Delete)

---

### Krok 5.4: Otevři editor

1. **Klikni na ikonu tužky** ✏️ (Edit)

**Co se stane:**
- Soubor se otevře v editoru
- Můžeš měnit text

---

### Krok 5.5: Najdi řádky k úpravě

**V editoru uvidíš kód, který vypadá nějak takto:**

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

**Musíš nahradit slova `YOUR_API_KEY` atd. svými hodnotami!**

---

### Krok 5.6: Nahraď hodnoty

**Otevři si Poznámkový blok** (nebo Word), kde máš zkopírované Firebase klíče z Kroku 4.6.

**Postupně nahraď tyto řádky:**

1. **Řádek s `apiKey`:**
   - **Najdi:** `apiKey: "YOUR_API_KEY",`
   - **Vymaž:** `YOUR_API_KEY` (nech uvozovky a čárku!)
   - **Vlož:** svůj apiKey (z Poznámkového bloku)
   - **Výsledek:** `apiKey: "AIzaSyDXXXXXXXXXXXXXXXXXXXXXXX",`

2. **Řádek s `authDomain`:**
   - **Najdi:** `authDomain: "YOUR_PROJECT_ID.firebaseapp.com",`
   - **Vymaž:** `YOUR_PROJECT_ID.firebaseapp.com`
   - **Vlož:** svůj authDomain
   - **Výsledek:** `authDomain: "terka-tracking-a1b2c.firebaseapp.com",`

3. **Řádek s `projectId`:**
   - **Najdi:** `projectId: "YOUR_PROJECT_ID",`
   - **Vymaž:** `YOUR_PROJECT_ID`
   - **Vlož:** svůj projectId
   - **Výsledek:** `projectId: "terka-tracking-a1b2c",`

4. **Řádek s `storageBucket`:**
   - **Najdi:** `storageBucket: "YOUR_PROJECT_ID.appspot.com",`
   - **Vymaž:** `YOUR_PROJECT_ID.appspot.com`
   - **Vlož:** svůj storageBucket
   - **Výsledek:** `storageBucket: "terka-tracking-a1b2c.appspot.com",`

5. **Řádek s `messagingSenderId`:**
   - **Najdi:** `messagingSenderId: "YOUR_MESSAGING_SENDER_ID",`
   - **Vymaž:** `YOUR_MESSAGING_SENDER_ID`
   - **Vlož:** svůj messagingSenderId
   - **Výsledek:** `messagingSenderId: "123456789012",`

6. **Řádek s `appId`:**
   - **Najdi:** `appId: "YOUR_APP_ID"`
   - **Vymaž:** `YOUR_APP_ID`
   - **Vlož:** svůj appId
   - **Výsledek:** `appId: "1:123456789012:web:abcdef123456"`

---

### Krok 5.7: Zkontroluj výsledek

**Zkontroluj, že:**
- ✅ Všechny hodnoty jsou v uvozovkách `"..."`
- ✅ Na konci každého řádku je čárka `,` (kromě posledního)
- ✅ Žádné hodnoty neobsahují `YOUR_` prefix
- ✅ Všechny závorky jsou správně `{` a `}`

**Příklad správně vyplněné konfigurace:**
```javascript
const firebaseConfig = {
    apiKey: "AIzaSyDXXXXXXXXXXXXXXXXXXXXXXX",
    authDomain: "terka-tracking-a1b2c.firebaseapp.com",
    projectId: "terka-tracking-a1b2c",
    storageBucket: "terka-tracking-a1b2c.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
};
```

---

### Krok 5.8: Ulož změny (Commit)

**Scrolluj dolů** na konec editoru. Uvidíš sekci **"Commit changes"**

1. **V prvním poli** (Commit message) napiš:
   - `config: Přidání Firebase konfigurace`

2. **Druhé pole** (Extended description) nech prázdné

3. **Vyber:** "Commit directly to the `claude/competitor-order-tracker-1H0ek` branch"

4. **Klikni na zelené tlačítko** **"Commit changes"**

**Co se stane:**
- Soubor se uloží
- Vrátíš se zpět na seznam souborů
- GitHub zobrazí tvůj commit

**Konfigurace je uložená!** ✅

---

## 🚀 ČÁST 6: Nasazení na Netlify

**Tato část závisí na tom, jak máš Netlify nastavený...**

### Varianta A: Máš propojenou GitHub Integration

**Pokud máš Netlify propojený s GitHubem (automatické nasazování):**

1. **Počkej 2-3 minuty**
   - Netlify automaticky detekuje změnu v GitHubu
   - Spustí se nový build

2. **Otevři Netlify dashboard:**
   - Jdi na `app.netlify.com`
   - Najdi svůj projekt
   - V sekci "Production deploys" uvidíš nový deploy

3. **Počkej, dokud neuvidíš** zelený status **"Published"**

4. **Otevři aplikaci** - klikni na URL svého webu

**Hotovo!** 🎉

---

### Varianta B: Používáš Netlify Drop (ruční nahrávání)

**Pokud nahráváš soubory ručně:**

1. **Stáhni repozitář z GitHubu:**
   - Na stránce GitHubu klikni na zelené tlačítko **"Code"**
   - Klikni **"Download ZIP"**
   - Ulož ZIP soubor na počítač
   - Rozbal ho (pravé tlačítko → Extract)

2. **Otevři Netlify Drop:**
   - Jdi na `app.netlify.com/drop`

3. **Přetáhni složku:**
   - Najdi rozbalenou složku na počítači
   - Přetáhni ji do okna Netlify Drop

4. **Počkej na nahrání:**
   - Netlify nahraje všechny soubory
   - Zobrazí se URL tvého webu

**Hotovo!** 🎉

---

## ✅ ČÁST 7: Ověření, že to funguje

### Krok 7.1: Otevři aplikaci

1. **Otevři svou aplikaci** v prohlížeči
   - URL vypadá nějak takto: `https://tvuj-web.netlify.app`

2. **Aplikace se načte** (může to trvat pár sekund)

---

### Krok 7.2: Otevři Developer Console

**Musíš zjistit, jestli se Firebase připojil...**

1. **Stiskni klávesu F12** na klávesnici
   - Nebo pravé tlačítko myši → "Inspect" → záložka "Console"

2. **Otevře se panel** na pravé nebo dolní straně obrazovky

3. **Klikni na záložku "Console"** (pokud není již vybraná)

---

### Krok 7.3: Hledej zprávy o Firebase

**V Console (černé pole s textem) hledej tyto zprávy:**

✅ **Pokud vidíš:**
```
🚀 Inicializace aplikace...
✅ Firebase úspěšně inicializován
✅ Firestore připojen - data budou sdílená v reálném čase
👂 Realtime listeners aktivní
```

**→ GRATULACE! FUNGUJE TO! 🎉🎉🎉**

---

❌ **Pokud vidíš červenou chybu:**
```
❌ Chyba při inicializaci Firebase: ...
⚠️ Používám LocalStorage - data pouze v tomto prohlížeči
```

**→ Něco je špatně. Přejdi na sekci "Řešení problémů" níže.**

---

### Krok 7.4: Test živé synchronizace

**Ověř, že data se skutečně sdílí:**

1. **Otevři aplikaci ve DVOU OKNECH:**
   - První okno: normální okno prohlížeče
   - Druhé okno: inkognito/soukromé okno
   - Nebo otevři na mobilu a počítači současně

2. **V prvním okně:**
   - Přidej nový záznam objednávky
   - Klikni "Uložit"

3. **Ve druhém okně:**
   - **NEREFRESHUJ STRÁNKU!**
   - Záznam by se měl **objevit automaticky za pár sekund**

**Pokud se objevil → FUNGUJE LIVE SYNC! 🔥**

---

## 🐛 ŘEŠENÍ PROBLÉMŮ

### Problém 1: "Permission denied" chyba

**Co vidíš:**
- Červená chyba v Console: `Permission denied`

**Řešení:**
1. Vrať se na Firebase Console
2. Firestore Database → záložka "Rules"
3. Zkontroluj, že pravidla jsou správně (viz Část 3)
4. Klikni "Publish" znovu

---

### Problém 2: "Firebase: No Firebase App" chyba

**Co vidíš:**
- Červená chyba v Console: `Firebase: No Firebase App '[DEFAULT]' has been created`

**Řešení:**
1. Zkontroluj soubor `firebase-config.js` na GitHubu
2. Ověř, že všechny hodnoty jsou vyplněné (žádné `YOUR_...`)
3. Zkontroluj, že uvozovky a čárky jsou správně
4. Pokud jsi něco opravila, počkej na nový build na Netlify (2-3 min)

---

### Problém 3: Data se neukládají do Firestore

**Co vidíš:**
- V Console: "Používám LocalStorage"
- Data nejsou v Firebase Console → Firestore Database → Data

**Řešení:**
1. Zkontroluj, že v Console není červená chyba
2. Ověř, že Firebase je inicializovaný (viz Krok 7.3)
3. Zkontroluj Security Rules (Část 3)
4. Zkus refreshnout aplikaci (F5)

---

### Problém 4: Aplikace se nenahraje na Netlify

**Co vidíš:**
- Deploy failed na Netlify
- Nebo 404 stránka

**Řešení:**
1. V Netlify dashboardu klikni na failed deploy
2. Přečti si error message
3. Zkontroluj, že branch `claude/competitor-order-tracker-1H0ek` existuje
4. Případně zkus deploy znovu (tlačítko "Retry deploy")

---

### Problém 5: Nevím, jestli mám Netlify propojený s GitHubem

**Jak zjistit:**
1. Otevři Netlify dashboard
2. Najdi svůj projekt
3. Klikni na něj
4. Podívej se na sekci "Site configuration" → "Build & deploy"
5. Pokud vidíš "GitHub" nebo "Git provider" → MÁŠ propojené (Varianta A)
6. Pokud nic nevidíš → NEMÁŠ propojené (Varianta B - Drop)

---

## 💰 Kolik to stojí?

**ZDARMA!**

Firebase Free tier (Spark plan):
- ✅ 50,000 reads/den
- ✅ 20,000 writes/den
- ✅ 1 GB storage

**Pro tvoje použití (sledování ~50 e-shopů) je to více než dost.**

Pokud bys náhodou překročila limit (velmi nepravděpodobné), Firebase ti pošle email. Můžeš buď:
- Upgradovat na placený plán (pay-as-you-go)
- Nebo nic nedělat a počkat na další měsíc (limit se resetuje)

---

## 🎉 HOTOVO!

**Gratulace! Máš funkční živou synchronizaci dat!**

**Co to znamená:**
- ✅ Data se sdílí mezi všemi uživateli
- ✅ Změny vidíš okamžitě (bez refreshe)
- ✅ Funguje na všech zařízeních
- ✅ Automatické zálohování v cloudu

**Užívej si aplikaci! 🚀**

---

## 📞 Kontakt na pomoc

**Pokud se zasekneš:**
1. Zkontroluj sekci "Řešení problémů" výše
2. Vyfotografuj chybovou hlášku v Console (F12)
3. Napiš mi do Issues na GitHubu nebo emailem

**Hodně štěstí! 💪**
