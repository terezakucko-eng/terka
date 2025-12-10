# 🏃 MoveIn - Fitness Studio Website

Moderní webová stránka pro fitness studio MoveIn s rezervačním systémem, informacemi o lekcích a interaktivní nástěnkou.

## ✨ Funkce

- **🎨 Černo-žlutý design** - Moderní a atraktivní vzhled
- **📅 Rezervační systém** - Jednoduché online rezervace lekcí
- **📧 Emailové notifikace** - Automatické potvrzení rezervací pro klienty i studio
- **🏋️ Přehled lekcí** - Dlaždice s detailními informacemi o jednotlivých lekcích
- **📰 Informační nástěnka** - Aktuality s možností komentování
- **📱 Responzivní design** - Perfektní zobrazení na všech zařízeních
- **🔒 Validace formulářů** - Zabezpečené a ověřené vstupy

## 🚀 Rychlý start

### Požadavky

- Node.js (verze 14 nebo novější)
- npm nebo yarn
- SMTP email účet (Gmail, Seznam, Outlook, atd.)

### Instalace

1. **Naklonujte repozitář nebo stáhněte soubory**

```bash
git clone <repository-url>
cd terka
```

2. **Nainstalujte závislosti**

```bash
npm install
```

3. **Nakonfigurujte emailové nastavení**

Vytvořte soubor `.env` zkopírováním `.env.example`:

```bash
cp .env.example .env
```

Upravte `.env` soubor s vašimi SMTP údaji:

```env
PORT=3000

# Pro Gmail:
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=vas-email@gmail.com
SMTP_PASS=vase-app-heslo

ADMIN_EMAIL=info@movein.cz
```

**Důležité:** Pro Gmail musíte vytvořit "App Password":
- Přejděte na: https://myaccount.google.com/security
- Zapněte 2-Step Verification
- Vytvořte App Password a použijte ho v `.env`

4. **Spusťte server**

```bash
npm start
```

Server poběží na: http://localhost:3000

## 📁 Struktura projektu

```
terka/
├── index.html          # Hlavní HTML struktura
├── styles.css          # CSS styly (černo-žlutý design)
├── script.js           # Frontend JavaScript
├── server.js           # Backend server (Express.js)
├── package.json        # NPM závislosti
├── .env.example        # Příklad konfigurace
├── .env                # Vaše konfigurace (neverzováno)
├── .gitignore          # Git ignore soubor
├── logo.png            # Logo MoveIn (nahraďte vlastním)
└── README.md           # Tato dokumentace
```

## 🎨 Přizpůsobení

### Změna barev

Upravte CSS proměnné v `styles.css`:

```css
:root {
    --primary-color: #FFD700;      /* Žlutá */
    --secondary-color: #FFC000;    /* Tmavší žlutá */
    --dark-bg: #1a1a1a;            /* Tmavé pozadí */
    --darker-bg: #0d0d0d;          /* Ještě tmavší */
}
```

### Přidání/úprava lekcí

Upravte sekci `<div class="lessons-grid">` v `index.html`:

```html
<div class="lesson-card">
    <div class="lesson-icon">
        <i class="fas fa-your-icon"></i>
    </div>
    <h3>Název lekce</h3>
    <p class="lesson-time">Dny | Čas</p>
    <p class="lesson-description">Popis lekce</p>
    <!-- ... -->
</div>
```

### Změna loga

Nahraďte soubor `logo.png` vlastním logem.

## 📧 Konfigurace emailů

### Gmail

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=vas-email@gmail.com
SMTP_PASS=app-specific-password
```

### Seznam.cz

```env
SMTP_HOST=smtp.seznam.cz
SMTP_PORT=465
SMTP_USER=vas-email@seznam.cz
SMTP_PASS=vase-heslo
```

### Outlook/Hotmail

```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=vas-email@outlook.com
SMTP_PASS=vase-heslo
```

## 🔧 API Endpointy

### POST /api/reservation

Vytvoří novou rezervaci a odešle potvrzovací emaily.

**Request Body:**
```json
{
    "name": "Jan Novák",
    "email": "jan@email.cz",
    "phone": "+420123456789",
    "lesson": "Yoga",
    "date": "2025-12-15",
    "time": "17:00",
    "message": "Volitelná zpráva"
}
```

**Response:**
```json
{
    "success": true,
    "message": "Rezervace byla úspěšně odeslána."
}
```

### GET /api/health

Zkontroluje, zda server běží.

**Response:**
```json
{
    "status": "OK",
    "message": "MoveIn API is running",
    "timestamp": "2025-12-10T10:00:00.000Z"
}
```

## 🚀 Nasazení do produkce

### Heroku

1. Vytvořte účet na [Heroku](https://heroku.com)
2. Nainstalujte Heroku CLI
3. Nasaďte aplikaci:

```bash
heroku create movein-fitness
git push heroku main
heroku config:set SMTP_USER=vas-email@gmail.com
heroku config:set SMTP_PASS=vase-heslo
heroku config:set ADMIN_EMAIL=info@movein.cz
```

### Vercel/Netlify

Pro statické soubory (HTML, CSS, JS) můžete použít Vercel nebo Netlify.
Backend (server.js) bude potřeba hostovat samostatně.

### VPS (DigitalOcean, Linode, atd.)

1. Nahrajte soubory na server
2. Nainstalujte Node.js a npm
3. Spusťte aplikaci s PM2:

```bash
npm install -g pm2
pm2 start server.js --name movein
pm2 startup
pm2 save
```

## 🛡️ Bezpečnost

- **Validace**: Všechny formuláře jsou validovány na frontendu i backendu
- **XSS ochrana**: Vstupy jsou escapovány proti XSS útokům
- **CORS**: Nakonfigurováno pro zabezpečené API požadavky
- **Env proměnné**: Citlivé údaje jsou v `.env` (neverzováno)

## 📱 Responzivita

Web je plně responzivní a optimalizovaný pro:
- 📱 Mobily (< 480px)
- 📱 Tablety (480px - 768px)
- 💻 Desktop (> 768px)

## 🐛 Řešení problémů

### Email se neposílá

1. Zkontrolujte `.env` konfiguraci
2. Ověřte SMTP údaje
3. Pro Gmail: použijte App Password
4. Zkontrolujte firewall/antivirus

### Port už je používán

Změňte port v `.env`:
```env
PORT=3001
```

### Formulář neposílá data

1. Zkontrolujte, že backend běží na `http://localhost:3000`
2. Otevřete konzoli prohlížeče (F12) a hledejte chyby
3. Ověřte CORS nastavení

## 📝 Licence

MIT License - volně použitelné pro komerční i nekomerční účely.

## 👥 Podpora

Pro dotazy a podporu kontaktujte:
- 📧 Email: info@movein.cz
- 📞 Telefon: +420 123 456 789

## 🎉 Changelog

### Verze 1.0.0 (2025-12-10)
- ✨Initální release
- 📅 Rezervační systém
- 📧 Emailové notifikace
- 🏋️ Přehled lekcí
- 📰 Informační nástěnka s komentáři
- 🎨 Černo-žlutý design

---

Vytvořeno s ❤️ pro MoveIn Fitness Studio
