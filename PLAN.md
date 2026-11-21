# KineAid – Plan

KineAid helpt patiënten hun kine-oefeningen thuis correct en regelmatig uit te voeren.
De kinesitherapeut stelt programma's samen uit een oefeningenbibliotheek en deelt een
link/QR-code waarmee patiënten zich bij hem registreren.

## 1. Architectuur

| Onderdeel | Keuze | Waarom |
|---|---|---|
| App | **PWA** (installeerbare webapp) – React + TypeScript + Vite | Eén codebase voor Android, iOS en desktop; geen app store nodig ("Zet op beginscherm"). Later eventueel verpakken met Capacitor. |
| UI | Tailwind CSS | Snel, mobile-first |
| Talen | Nederlands + Engels (`react-i18next`), oefeningen via vertaaltabel | |
| Backend | **Supabase** (Postgres + Auth + Storage + Row Level Security), regio EU (Frankfurt) | Gratis tier, geen eigen server nodig |
| Hosting | **Cloudflare Pages** | Gratis, commercieel gebruik toegestaan |
| Login | E-mail (magic link / wachtwoord) + Google | Apple-login vereist betalend Apple Developer-account → later |

Aandachtspunten gratis tier:
- Supabase-project pauzeert na 7 dagen inactiviteit (gratis tier); opslag 1 GB → foto's comprimeren, video's als YouTube-link.

## 2. Oefeningenbibliotheek

Bronnen (allemaal met bronvermelding in de app, pagina **Bronnen / Credits** en per oefening):

| Bron | Licentie | Gebruik |
|---|---|---|
| [free-exercise-db](https://github.com/yuhonas/free-exercise-db) | Unlicense (publiek domein) | Basisimport (~870 oefeningen, foto's) |
| [wger](https://wger.de) | CC-BY-SA (tekst); afbeeldingen per afbeelding verschillend | Extra import, met auteur + licentie per oefening; alleen afbeeldingen met vrije licentie |
| KineAid eigen set | Eigen werk | 30–50 typische revalidatie-oefeningen + eigen SVG-pictogrammen |
| Eigen oefeningen van de kine | Eigendom van de kine | Zichtbaar voor de kine en zijn patiënten |

Per oefening:
- naam, korte omschrijving, stap-voor-stap instructies (per taal)
- **"Hier moet je op letten"** (aandachtspunten / veelgemaakte fouten, per taal)
- lichaamsdelen (filter), spiergroepen, materiaal, moeilijkheid
- type: *herhalingen* of *tijd (aanhouden)*; standaardwaarden voor sets/herhalingen/tijd/rust
- foto's (meerdere, Supabase Storage), optionele video-URL
- bron + licentie + auteur (voor de credits)

Spiergroepen uit de open databanken worden gemapt naar lichaamsdelen
(nek, schouder, elleboog/arm, pols/hand, borst, rug-boven, rug-onder, buik/romp, heup, knie, enkel/voet, volledig lichaam).

## 3. Datamodel (Supabase)

```
profiles               id (=auth.users), role (kine|patient), full_name, locale
practices              id, kine_id, name, invite_code
patient_links          patient_id, kine_id, status (active|archived), created_at
exercises              id, kind (reps|time), body_parts[], muscles[], equipment, level,
                       default_sets, default_reps, default_hold_sec, default_rest_sec,
                       video_url, source, source_url, license, author, owner_id (null = publiek)
exercise_translations  exercise_id, locale, name, description, instructions[], attention_points[]
exercise_images        id, exercise_id, url/storage_path, position, license, author
programs               id, patient_id, kine_id, name, active, start_date, end_date
program_items          id, program_id, exercise_id, position, sets, reps, hold_sec, rest_sec,
                       times_per_day, days_per_week, note
session_logs           id, patient_id, program_id, started_at, completed_at
exercise_logs          id, session_id, program_item_id, sets_done, completed, pain (0–10), comment
```

Row Level Security:
- patiënt ziet enkel eigen profiel, programma's en logs
- kine ziet enkel zijn gekoppelde patiënten en hun programma's/logs
- publieke oefeningen leesbaar voor iedereen die is ingelogd; eigen oefeningen enkel voor de eigenaar en diens patiënten

## 4. Functionaliteit

**Kine (web)**
1. Registreren/inloggen, praktijk aanmaken
2. Uitnodigingslink + QR-code (delen, afdrukken)
3. Patiëntenlijst + therapietrouw
4. Programma samenstellen: zoeken op naam, filteren op lichaamsdeel, raster met pictogrammen; per oefening sets/herhalingen/houdtijd/rust/frequentie/notitie
5. Eigen oefeningen aanmaken/bewerken: foto's, beschrijving, instructies, "Hier moet je op letten", lichaamsdeel, type

**Patiënt (mobiel)**
1. Registreren via link/QR → automatisch gekoppeld
2. "Vandaag" → **Start workout**
3. Per oefening: foto's, uitleg, aandachtspunten
   - tijd: Start → aftellen, geluid/trilling, rust, volgende set
   - herhalingen: "Set voltooid" → "Compleet"
   - scherm blijft aan (Wake Lock)
4. Geschiedenis, reeks dagen op rij, optioneel pijnscore
5. Later: herinneringen (web push; iOS enkel als geïnstalleerde PWA)

## 5. Privacy (GDPR)
Gezondheidsgegevens = bijzondere categorie. EU-regio, dataminimalisatie (geen diagnoses),
privacyverklaring + toestemming bij registratie, account & data zelf verwijderen.

## 6. Fasering

| Fase | Inhoud | Status |
|---|---|---|
| 0 – Fundament | Projectstructuur, PWA, i18n NL/EN, Supabase-schema + RLS, login, rollen, credits-pagina, importscript open databanken | 🚧 bezig |
| 1 – Eigen gebruik | Bibliotheek (zoeken/filteren), programma's, workout-speler met timer/teller, logging | |
| 2 – Kine-portaal | Kineregistratie, uitnodiging + QR, patiëntenlijst, programma's toewijzen, eigen oefeningen met foto's | |
| 3 – Afwerking | Therapietrouw-overzicht, pijnscore, herinneringen, privacyverklaring, offline | |
| 4 – Optioneel | Apple-login, Capacitor (app stores), extra talen (FR) | |

## 7. Lokaal opstarten
Zie [README.md](README.md).
