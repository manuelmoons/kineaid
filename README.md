# KineAid

Een installeerbare webapp (PWA) voor kine-oefeningen: de kine stelt programma's samen,
de patiënt voert ze uit met timer en teller. Zie [PLAN.md](PLAN.md) voor het volledige plan.

**Stack:** React + TypeScript + Vite · Tailwind · Supabase (Postgres, Auth, Storage) · Cloudflare Pages

## 1. Benodigdheden

- [Node.js LTS](https://nodejs.org) (20 of hoger) en [Git](https://git-scm.com)

  ```powershell
  winget install OpenJS.NodeJS.LTS
  winget install Git.Git
  ```

- Een gratis [Supabase](https://supabase.com)-account

## 2. Supabase instellen

1. Maak een nieuw project aan, regio **Central EU (Frankfurt)**.
2. Open **SQL Editor** en voer na elkaar de scripts in [supabase/migrations](supabase/migrations) uit
   (`0001_init.sql`, `0002_fix_invite_code.sql`, `0003_grants.sql`): plakken → **Run**.
3. **Authentication → URL Configuration**: zet *Site URL* op `http://localhost:5173`
   (later je Cloudflare-URL) en voeg beide toe aan *Redirect URLs* met `/**` erachter.
4. (Optioneel) **Authentication → Providers → Google**: aanzetten met een OAuth-client uit de
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
   Redirect-URI: `https://<jouw-project>.supabase.co/auth/v1/callback`.
5. Kopieer `.env.example` naar `.env` en vul de waarden in uit **Project Settings → API Keys**:
   de *Project URL* (`https://<project-id>.supabase.co`) en de *Publishable key* (`sb_publishable_…`,
   vroeger "anon key").

## 3. Lokaal starten

```powershell
npm install
```

```powershell
npm run dev
```

Open http://localhost:5173.

## 4. Oefeningenbibliotheek importeren

```powershell
npm run import:exercises
```

Dit laadt de eigen KineAid-set (NL/EN), [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
(publiek domein) en [wger](https://wger.de) (CC-BY-SA, enkel afbeeldingen met vrije licentie).
Bron, licentie en auteur worden per oefening bewaard en getoond op de pagina **Bronnen**.

- Alleen bepaalde bronnen: `npm run import:exercises -- --sources=kineaid,free-exercise-db`
- Eerst bekijken zonder te schrijven: `npm run import:exercises -- --dry-run`

Het script gebruikt de `SUPABASE_SECRET_KEY` (*Secret key*, `sb_secret_…`). Die sleutel hoort **nooit** in de app of in Git.

## 5. Gratis online zetten (Cloudflare Pages)

1. Zet de code op GitHub.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Build command `npm run build`, output directory `dist`.
4. Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
5. Voeg de Pages-URL toe aan de Supabase Redirect URLs.

De bestanden `public/_redirects` zorgen ervoor dat links zoals `/join/ABC123` rechtstreeks werken.

## Projectstructuur

```
src/
  components/   Layout, taalkeuze
  i18n/         nl.json, en.json
  lib/          supabase-client, auth, lichaamsdelen
  pages/        Login, Welkom, Join (uitnodiging), Patiënt, Kine, Bronnen
supabase/migrations/   databaseschema + Row Level Security
scripts/               import van de open oefeningendatabanken
```
