# La-Solución – Checklist live zetten

Gebruik deze checklist om de app in productie te draaien. Alles moet klaar zijn voordat gebruikers de app via HTTPS openen.

---

## Voor je begint

- [ ] Node.js 18+ op de server (of in je hosting-omgeving).
- [ ] Een (sub)domein voor de app, bijv. `app.la-solucion.nl`.
- [ ] HTTPS geregeld (reverse proxy of SSL van je host).

---

## Stap 1: Database

- [ ] Maak een **PostgreSQL**-database aan bij een van:
  - [Neon](https://neon.tech) → New Project → kopieer connection string
  - [Supabase](https://supabase.com) → New Project → Settings → Database → Connection string (URI)
  - [Railway](https://railway.app) → New Project → Add PostgreSQL → `DATABASE_URL` wordt gegenereerd
- [ ] Bewaar de **connection string** (bijv. `postgresql://user:password@host:5432/dbname`) voor stap 3.

De app maakt bij het eerste starten zelf de tabellen aan (migratie in `server/db.js`).

---

## Stap 2: Omgevingsvariabelen op de server

Kopieer `.env.example` naar `.env` op de server en vul alle waarden in. **Verplicht in productie:**

| Variabele      | Voorbeeld / toelichting |
|----------------|--------------------------|
| `NODE_ENV`     | `production` |
| `JWT_SECRET`   | Min. 32 tekens, willekeurig. Genereer bijv.: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CORS_ORIGIN`  | Exacte app-URL, **met HTTPS**, geen slash aan het eind, bijv. `https://app.la-solucion.nl` |
| `APP_BASE_URL` | Zelfde als `CORS_ORIGIN` (gebruikt voor wachtwoord-resetlinks) |
| `DATABASE_URL` | PostgreSQL connection string uit stap 1 |

Optioneel: `PORT` (default 4000), en voor e-mail (wachtwoord herstellen): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.

- [ ] `.env` op de server aangemaakt en alle verplichte variabelen gezet.

---

## Stap 3: Build en bestanden op de server

**Lokaal of in CI:**

```bash
npm install
npm run build
```

- [ ] `npm run build` succesvol uitgevoerd (er is een map `dist/`).

**Op de server:**

Zorg dat op de server aanwezig zijn:

- `dist/` (gehele map)
- `server/`
- `package.json`
- `package-lock.json`
- `node_modules/` (of voer op de server `npm install --production` uit)

- [ ] Alle bestanden staan op de server (bijv. via git clone + build, of upload).

---

## Stap 4: Starten

Op de server (in de projectmap, waar `package.json` staat):

```bash
NODE_ENV=production npm start
```

of:

```bash
NODE_ENV=production node server/index.js
```

- [ ] App start zonder foutmelding.
- [ ] In de console staat o.a.: `Productie: frontend + API op PORT ...`

**Als de app weigert te starten:**

- `JWT_SECRET is niet ingesteld` → Zet in `.env` een lang, willekeurig geheim (min. 32 tekens).
- `CORS_ORIGIN moet in productie op je echte app-URL staan` → Zet `CORS_ORIGIN` (en `APP_BASE_URL`) op je echte https-URL.
- `DATABASE_URL is verplicht` → Vul de PostgreSQL connection string in.
- `Map 'dist' ontbreekt` → Voer lokaal of op de server `npm run build` uit en deploy opnieuw.

---

## Stap 5: HTTPS en bereikbaarheid

- [ ] De app is **alleen via HTTPS** bereikbaar (geen onbeveiligde http voor gebruikers).
- [ ] `CORS_ORIGIN` en `APP_BASE_URL` gebruiken die **https**-URL.
- [ ] Reverse proxy (Nginx, Caddy, of SSL van je host) stuurt verkeer naar `PORT` (default 4000).

Gebruikers openen **één URL** (bijv. `https://app.la-solucion.nl`). Dezelfde server levert dan de frontend en de API; er is geen aparte frontend-server nodig.

---

## Controle na deploy

- [ ] In de browser: `https://jouw-app-url` opent het inlogscherm.
- [ ] Registreren en inloggen werken.
- [ ] Opdrachten laden en opslaan werkt (database gekoppeld).
- [ ] (Optioneel) Wachtwoord vergeten / reset werkt als SMTP is geconfigureerd.

---

## Samenvatting

1. PostgreSQL aanmaken → `DATABASE_URL` kopiëren.
2. Op de server `.env` vullen (o.a. `NODE_ENV`, `JWT_SECRET`, `CORS_ORIGIN`, `APP_BASE_URL`, `DATABASE_URL`).
3. `npm install` en `npm run build` (lokaal of op server); `dist/` + rest van de app op de server.
4. `NODE_ENV=production npm start` op de server.
5. App alleen via HTTPS bereikbaar maken en in CORS/APP_BASE_URL die URL gebruiken.

Meer uitleg: **README.md** → sectie “Live zetten (deploy)”.
