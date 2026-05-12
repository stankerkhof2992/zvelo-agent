# Zvelo — Etsy AI Agent

Volledig geautomatiseerde Etsy listing agent voor digitale producten. Genereert dagelijks nieuwe productconcepten via Claude AI, maakt gratis afbeeldingen via **Pollinations.ai**, en publiceert listings op Etsy na jouw goedkeuring. Werkt volledig gratis zonder betaalde API-keys.

---

## Vereisten

- Node.js 18 of hoger — download op [nodejs.org](https://nodejs.org)
- NPM (wordt meegeleverd met Node.js)

---

## Installatie (stap voor stap)

### 1. Backend installeren

Open een terminal in de `zvelo-agent` map en voer uit:

```bash
cd backend
npm install
```

### 2. .env bestand aanmaken

```bash
copy .env.example .env
```

Open `.env` in Kladblok of VS Code en vul je API keys in (zie hieronder).

### 3. Frontend installeren

Open een **tweede** terminal:

```bash
cd frontend
npm install
```

---

## Gratis pipeline — geen betaalde API's nodig

Zvelo werkt volledig gratis dankzij:

| Stap | Service | Kosten |
|------|---------|--------|
| Tekst genereren | Claude AI (Anthropic) | Gratis met eigen key (optioneel) |
| Afbeeldingen | **Pollinations.ai** | **Volledig gratis, geen key nodig** |
| Mockups | Sharp (lokaal, ingebouwd) | Gratis |
| PDF aanmaken | pdfkit (lokaal, ingebouwd) | Gratis |
| Publiceren | Etsy API | Gratis account nodig |

### Over Pollinations.ai

Pollinations.ai is een gratis, open-source AI afbeeldingengenerator. Je hoeft:
- **Geen account aan te maken**
- **Geen API key in te voeren**
- **Niets te betalen**

De agent stuurt automatisch een verzoek naar `image.pollinations.ai` en krijgt een 3000×3000px afbeelding terug. Als Pollinations.ai niet bereikbaar is (bv. offline), maakt de agent automatisch een grijze placeholder zodat de rest van de pipeline gewoon doorgaat.

---

## API Keys — Waar aanvragen

Alle keys zijn optioneel. Zonder keys draait de app in **simulatiemodus** (nep-data, alles werkt maar er worden geen echte calls gemaakt).

### Anthropic Claude (tekst genereren)
1. Ga naar [console.anthropic.com](https://console.anthropic.com)
2. Maak een account aan
3. Ga naar Settings → API Keys → Create Key
4. Kopieer de key naar `ANTHROPIC_API_KEY=` in .env

### Etsy API (publiceren)
1. Ga naar [etsy.com/developers/register](https://www.etsy.com/developers/register)
2. Maak een app aan
3. Stel de **Redirect URI** in op: `http://localhost:3001/auth/etsy/callback`
4. Kopieer de **Keystring** naar `ETSY_CLIENT_ID=`
5. Kopieer het **Shared Secret** naar `ETSY_CLIENT_SECRET=`

---

## Etsy OAuth koppeling instellen

Na het instellen van je Etsy API keys:

1. Start de backend server (zie hieronder)
2. Ga in het dashboard naar **Shops**
3. Klik op **+ Shop toevoegen** en vul je shopnaam in
4. Klik op **Koppel met Etsy OAuth**
5. Je wordt doorgestuurd naar Etsy — klik op Toestaan
6. Je shop wordt automatisch opgeslagen

---

## De agent starten

### Optie 1 — Twee aparte terminals

**Terminal 1 (backend):**
```bash
cd backend
node server.js
```

**Terminal 2 (frontend):**
```bash
cd frontend
npm run dev
```

### Optie 2 — Met auto-reload tijdens ontwikkeling

```bash
cd backend
npm run dev
```

Open het dashboard op: **http://localhost:5173**

---

## Dagelijkse automatisering

De agent draait automatisch elke dag om **08:00** (Amsterdam tijd).

Wat er automatisch gebeurt:
1. Niche analyse via Claude AI
2. 3 productconcepten genereren (titel, beschrijving, tags, prijs)
3. Afbeelding genereren via Pollinations.ai (gratis, 3000×3000px)
4. 3 mockup varianten aanmaken via Sharp (lokaal, gratis)
5. Print-ready A4 PDF aanmaken via pdfkit (lokaal, gratis)
6. Wacht op jouw goedkeuring in het dashboard

**Nooit automatisch publiceren** — jij keurt altijd goed.

Het tijdstip aanpassen: ga naar **Instellingen** in het dashboard en verander het schema.

---

## Dashboard overzicht

| Pagina | Functie |
|--------|---------|
| ☀️ Vandaag | Nieuwe concepten beoordelen: goedkeuren / bewerken / afwijzen |
| 📋 Wachtrij | Alle concepten met filters en bulk-acties |
| 🚀 Gepubliceerd | Live Etsy listings met stats |
| 🤖 Agent | Niche analyse, logs, handmatig triggeren, kosten |
| 🏪 Shops | Etsy shops beheren en OAuth koppelen |
| 📊 Rapport | Wekelijkse omzet charts en AI-aanbevelingen |
| ⚙️ Instellingen | API keys, schema, notificaties |

---

## Mappenstructuur

```
zvelo-agent/
├── render.yaml            ← Render.com deployment config
├── backend/
│   ├── server.js          ← Express server
│   ├── database.js        ← SQLite setup (node:sqlite)
│   ├── .env               ← Jouw API keys (maak aan via .env.example)
│   ├── .env.example       ← Template
│   ├── routes/
│   │   ├── concepts.js    ← Concept CRUD + publiceren
│   │   ├── agent.js       ← Agent besturing + rapporten
│   │   ├── shops.js       ← Shop beheer
│   │   ├── auth.js        ← Etsy OAuth PKCE flow
│   │   └── settings.js    ← Instellingen + export
│   └── services/
│       ├── claude.js      ← Anthropic API + simulatie
│       ├── imageGen.js    ← Pollinations.ai afbeeldingen (gratis)
│       ├── mockups.js     ← Sharp mockups (3 templates, lokaal)
│       ├── pdf.js         ← pdfkit A4 PDF generatie (lokaal)
│       ├── etsyService.js ← Etsy API v3 + simulatie
│       ├── scheduler.js   ← Dagelijkse automatisering (08:00)
│       └── emailService.js ← Nodemailer notificaties
├── frontend/
│   └── src/
│       ├── pages/         ← 7 dashboard pagina's
│       └── components/    ← ConceptCard, ImageGallery, etc.
└── assets/
    ├── generated/         ← Pollinations.ai afbeeldingen
    ├── mockups/           ← Sharp mockup output
    └── products/          ← Print-ready PDF bestanden
```

---

---

## Deployen op Render.com (online zetten)

Met Render.com draait de agent 24/7 in de cloud — ook als je computer uit is. Je kunt het dashboard dan ook op je telefoon of tablet openen.

### Stap 1 — Code op GitHub zetten

1. Maak een gratis account op [github.com](https://github.com)
2. Maak een nieuw repository aan (klik op **New** → naam bijv. `zvelo-agent`)
3. Open PowerShell in de `zvelo-agent` map en voer uit:
   ```
   git init
   git add .
   git commit -m "Eerste versie"
   git remote add origin https://github.com/JOUW-NAAM/zvelo-agent.git
   git push -u origin main
   ```

### Stap 2 — Render account aanmaken

1. Ga naar [render.com](https://render.com) en maak een gratis account aan
2. Klik op **New** → **Web Service**
3. Verbind je GitHub account en selecteer je `zvelo-agent` repository

### Stap 3 — Instellingen controleren

Render herkent automatisch het `render.yaml` bestand. Controleer:
- **Build Command**: `cd backend && npm install && cd ../frontend && npm install && npm run build`
- **Start Command**: `node --disable-warning=ExperimentalWarning backend/server.js`
- **Region**: Frankfurt (dichtstbij Nederland)

### Stap 4 — API keys invullen

Ga in Render naar **Environment** en voeg toe:
- `ANTHROPIC_API_KEY` — jouw Claude key (optioneel)
- `ETSY_CLIENT_ID` — jouw Etsy key (optioneel)
- `ETSY_CLIENT_SECRET` — jouw Etsy secret (optioneel)
- `ETSY_REDIRECT_URI` — stel in op `https://JOUW-APP-NAAM.onrender.com/auth/etsy/callback`

### Stap 5 — Deployen

Klik op **Create Web Service**. Render bouwt en start de app automatisch (duurt 2-5 minuten).

### Stap 6 — Dashboard openen

Na het deployen geeft Render je een URL zoals:
```
https://zvelo-agent.onrender.com
```

Open deze URL op je computer, telefoon of tablet — het dashboard werkt overal.

### Toegang via je telefoon

Zodra de app op Render draait:
1. Open de browser op je telefoon (Safari, Chrome)
2. Ga naar jouw Render URL, bijv. `https://zvelo-agent.onrender.com`
3. Voeg de pagina toe aan je beginscherm voor snel toegang:
   - **iPhone**: Deel-knop → "Zet op beginscherm"
   - **Android**: Drie puntjes → "Toevoegen aan beginscherm"

> **Let op gratis plan**: Op het gratis Render plan slaapt de app na 15 minuten inactiviteit. Het eerste verzoek duurt dan 30-60 seconden. Upgrade naar het **Starter plan** (€7/maand) voor altijd-actief.

### Etsy OAuth op Render instellen

Na deployment ga je naar **Instellingen** in het dashboard. Zet de Redirect URI in je Etsy developer account op:
```
https://JOUW-APP-NAAM.onrender.com/auth/etsy/callback
```

---

## Veelgestelde vragen

**Q: Werkt het zonder API keys?**
Ja — volledig. Alle functies werken in simulatiemodus met realistische nep-data. Alleen voor Etsy publicatie en Claude tekst heb je echte keys nodig.

**Q: Is Pollinations.ai echt gratis?**
Ja. Geen account, geen key, geen kosten. De afbeeldingen worden gegenereerd via een publieke gratis API. Als de service tijdelijk offline is, maakt de agent automatisch een placeholder zodat alles doorwerkt.

**Q: Worden er automatisch listings gepubliceerd?**
Nee, nooit. Jij keurt elk concept goed in het dashboard voor publicatie.

**Q: Waar worden afbeeldingen opgeslagen?**
Lokaal in `/assets/generated/`, mockups in `/assets/mockups/`, PDFs in `/assets/products/`. Op Render.com worden deze opgeslagen op de persistente disk (`/data/assets/`).

**Q: Kan ik meerdere Etsy shops koppelen?**
Ja, via de Shops pagina kun je meerdere shops toevoegen met elk hun eigen OAuth koppeling.

**Q: Hoe verander ik de niche?**
Via Instellingen → Standaard niche, of handmatig via de Agent pagina bij "Handmatig starten".

**Q: Wat kost het om op Render te draaien?**
Het gratis plan is voldoende om te testen. De app slaapt na 15 minuten inactiviteit. Voor 24/7 gebruik kost het Starter plan €7/maand. De disk voor de database (1GB) kost €0,25/maand extra op het betaalde plan.
