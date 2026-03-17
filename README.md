# La-Solución Adviesbureau – Intern Portaal

Deze app is een intern portaal voor **La-Solución Adviesbureau**. Het helpt eigenaren en medewerkers om opdrachten, klanten, afspraken en documenten overzichtelijk te organiseren.

De volledige interface is in het Nederlands.

## Functionaliteiten

- **Login-scherm** (zonder wachtwoord, voor intern gebruik)
  - Kies je naam en rol (Eigenaar of Medewerker).

- **Dashboard**

- **Opdrachtenbord**
  - Kolommen: **Nieuw**, **In behandeling**, **Afgerond**.
  - Opdrachtkaarten tonen:
    - Klantnaam.
    - Korte omschrijving.
    - Aanmaakdatum en (optioneel) deadline.
    - Prioriteit (1 hoog, 2 normaal, 3 laag).
    - Behandelaar (medewerker).
  - Klik op een kaart om alle details van de opdracht te bewerken.

- **Opdracht-detaildialoog**
  - Bewerk:
    - Klantnaam.
    - Omschrijving.
    - Categorie (bijv. Paspoort, Vergunning, Legalisatie, Intake).
    - Interne notities.
    - Status.
    - Prioriteit.
    - Behandelaar.
    - Deadline.
  - **Documenten uploaden**:
    - Voeg één of meerdere bestanden toe aan een opdracht.
    - De bestandsnamen en -groottes worden lokaal opgeslagen (demo).

- **Kalender**
  - Maandoverzicht met aanduiding van **vandaag**.
  - Opdrachten worden getoond op de dag van hun deadline.
  - Klik op een taak in de kalender om direct de opdracht te openen.

- **Opslag**
  - Met `DATABASE_URL` worden gebruikers, opdrachten en bestandsmetadata in PostgreSQL opgeslagen; uploads staan op de server.
  - Zonder database (alleen lokaal) gebruikt de backend een fallback (`server/data.json`) voor gebruikers.

## Kleuren en stijl

- Basiskleur: **marineblauw** (navy blue).
- Veel **wit** in de typografie, met accenten in **rood** als verwijzing naar de vlag van de Dominicaanse Republiek.
- Subtiele 3D-effecten:
  - Verhoogde kaarten met schaduw.
  - 3D-achtige hero-kaart op het inlogscherm.
- Professioneel en rustig, zonder drukke animaties.

## Project starten

Voorwaarden:

- Node.js 18+ geïnstalleerd.

Installeer dependencies in de hoofdmap van het project:

```bash
npm install
```

Start daarna de frontend en de backend:

```bash
# Terminal 1: backend (API + beveiligde login)
npm run dev:server

# Terminal 2: frontend
npm run dev
```

Open in je browser:

- `http://localhost:5173`

## Testwerkflow (eigenaar/medewerker)

Om rechten en zichtbaarheid te controleren kun je deze stappen volgen:

1. **Als eigenaar inloggen** – Log in met een eigenaar-account.
2. **Medewerker aanmaken** – Via registratie (of het admin/teamoverzicht) een nieuwe medewerker registreren.
3. **Medewerker activeren** – In het teamoverzicht de nieuwe medewerker **activeren** (indien standaard inactief).
4. **Opdracht toewijzen** – Maak of open een opdracht en wijzig de **Behandelaar** naar deze medewerker; sla op.
5. **Uitloggen** – Log uit.
6. **Als medewerker inloggen** – Log in met het account van die medewerker.
7. **Controleren** – Controleer dat in het opdrachtenbord alleen de aan die medewerker toegewezen opdrachten zichtbaar zijn; andere opdrachten zijn niet zichtbaar.

## Beveiliging (overzicht)

- **Gebruikers en login**
  - Registratie en login verlopen via een Node/Express-backend.
  - Wachtwoorden worden met `bcryptjs` gehashed opgeslagen (nooit in platte tekst).
  - Rollen: `Eigenaar` en `Medewerker`. Alleen de eerste geregistreerde gebruiker wordt automatisch eigenaar; overige registraties worden medewerker.
  - Inloggen levert een **JWT-token** op; deze token wordt bij elke beveiligde API-call gecontroleerd.

- **Autorisatie**
  - Zonder geldige JWT-token krijg je geen toegang tot beveiligde endpoints.
  - `/api/auth/me` geeft alleen de gegevens van de ingelogde gebruiker terug.
  - In de frontend zien medewerkers alleen hun eigen toegewezen opdrachten; eigenaren hebben een totaaloverzicht.

- **CORS en oorsprong**
  - De backend accepteert verkeer alleen van de oorsprong (origin) die je in `.env` zet (`CORS_ORIGIN`).
  - Standaard is dit `http://localhost:5173` voor lokale ontwikkeling.

- **Aanbevolen voor productie**
  - Gebruik een echte database (PostgreSQL) en stel alle omgevingsvariabelen in (zie hieronder).
  - Host frontend en backend uitsluitend via **HTTPS**.
  - Beperk toegang tot bestanden tot ingelogde gebruikers; rechten per rol worden in de API gecontroleerd.

---

## Live zetten (deploy)

**Volledige stap-voor-stap checklist:** zie **[DEPLOY.md](DEPLOY.md)**. Daar staat een afvinklijst en uitleg per stap.

Op de server kun je vóór het starten controleren of alle omgevingsvariabelen kloppen: `npm run check-env`.

### 1. PostgreSQL regelen

Kies één van deze opties en maak een database aan. Je krijgt een **connection string** (bijv. `postgresql://user:password@host:5432/dbname`).

| Aanbieder | Stappen |
|----------|--------|
| **Neon** | [neon.tech](https://neon.tech) → Account → New Project → kopieer de connection string. |
| **Supabase** | [supabase.com](https://supabase.com) → New Project → Settings → Database → "Connection string" (URI). |
| **Railway** | [railway.app](https://railway.app) → New Project → Add PostgreSQL → Variables → `DATABASE_URL` wordt gegenereerd. |

De app maakt bij opstarten zelf de tabellen aan (migratie in `server/db.js`).

### 2. Omgevingsvariabelen op de server

Zet op de **server** (host waar `node server/index.js` draait) de volgende variabelen. Gebruik nooit default-wachtwoorden of `localhost`-URL’s in productie.

| Variabele | Verplicht in productie | Beschrijving |
|-----------|------------------------|--------------|
| `NODE_ENV` | Ja | Zet op `production`. |
| `PORT` | Nee | Poort van de server (default `4000`). |
| `JWT_SECRET` | Ja | Lang, willekeurig geheim (bijv. 32+ tekens). **Verplicht in productie**; anders weigert de app te starten. |
| `CORS_ORIGIN` | Ja | Exacte URL van je frontend, bijv. `https://app.la-solucion.nl`. Geen trailing slash. |
| `APP_BASE_URL` | Aanbevolen | Dezelfde URL als waar gebruikers de app openen; gebruikt voor wachtwoord-resetlinks. Bijv. `https://app.la-solucion.nl`. |
| `DATABASE_URL` | Ja | PostgreSQL connection string van stap 1. |
| `SMTP_HOST` | Nee | Mailserver voor wachtwoord-reset (bijv. `smtp.gmail.com`). Leeg = reset-link alleen in serverlogs. |
| `SMTP_PORT` | Nee | Meestal `587`. |
| `SMTP_SECURE` | Nee | `true` voor poort 465. |
| `SMTP_USER` / `SMTP_PASS` | Nee | Inloggegevens voor de mailserver. |
| `MAIL_FROM` | Nee | Afzenderadres in e-mails, bijv. `no-reply@la-solucion.nl`. |

Een voorbeeld van alle variabelen staat in **`.env.example`** in de projectmap. Voorbeeld voor op de server (vul de waarden in):

```env
NODE_ENV=production
PORT=4000
JWT_SECRET=een-heel-lang-en-willekeurig-geheim-minstens-32-tekens
CORS_ORIGIN=https://app.la-solucion.nl
APP_BASE_URL=https://app.la-solucion.nl
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Optioneel: e-mail voor wachtwoord herstellen
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM=no-reply@la-solucion.nl
```

### 3. Build en start

Op je **eigen machine** of in een **CI-pipeline**:

```bash
npm install
npm run build
```

Dit maakt de frontend in de map `dist/`.

**Op de server** (of in je hosting-omgeving):

1. Zorg dat alle bestanden (inclusief `dist/`, `server/`, `package.json`, `node_modules`) op de server staan (bijv. via git deploy of upload).
2. Zet de omgevingsvariabelen (zie stap 2).
3. Start de app:

```bash
NODE_ENV=production node server/index.js
```

of, als je `npm start` gebruikt:

```bash
NODE_ENV=production npm start
```

De server luistert op `PORT` (default 4000) en serveert:
- **API** op `/api/*`
- **Frontend** (uit `dist/`) op alle andere routes (single-page app).

Gebruikers openen **alleen de URL van de server** (bijv. `https://jouw-domein.nl`). Er is geen aparte frontend-server nodig in productie.

### 4. HTTPS in productie

- **Altijd HTTPS gebruiken** voor de URL waar gebruikers de app openen. Zet achter een reverse proxy (Nginx, Caddy, of de ingebouwde SSL van je host) die TLS afhandelt.
- Stel `CORS_ORIGIN` en `APP_BASE_URL` in op die **https**-URL.
- Zonder HTTPS zijn inlogtokens en wachtwoorden onvoldoende beschermd.

### Samenvatting checklist live

1. PostgreSQL-database aanmaken (Neon / Supabase / Railway) en `DATABASE_URL` kopiëren.
2. Op de server: `JWT_SECRET`, `CORS_ORIGIN`, `APP_BASE_URL`, `DATABASE_URL` en optioneel SMTP-variabelen zetten; `NODE_ENV=production`.
3. `npm run build` uitvoeren en daarna `NODE_ENV=production npm start` (of `node server/index.js`) op de server.
4. App alleen via **HTTPS** bereikbaar maken en domein in CORS/APP_BASE_URL gebruiken.

---

## Toekomstige uitbreiding (suggesties)

- E-mailherinneringen voor deadlines en afspraken.
- Rapportages per periode of per medewerker.
- 2FA voor de eigenaar.

