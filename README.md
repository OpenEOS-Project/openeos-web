# OpenEOS Web

Admin-Dashboard und Kassen-UI für OpenEOS.

## Features

- Admin-Dashboard für Organisationen
- Mobile Kassen-UI (PWA)
- Event-Verwaltung
- Produkt- und Kategorie-Management
- Bestellübersicht
- Statistiken & Berichte

## Admin-Dashboard & Geräte-UI

Diese App bedient zwei Zielgruppen aus einer Codebasis:

- Das **Admin-Dashboard** (`/[locale]/(dashboard)/...`) für Organisationsverwaltung, Produkte, Events, Geräte, Drucker usw.
- Die **Geräte-UIs**, die auf den registrierten Geräten selbst laufen:
  - `/device/pos` – die mobile Kassen-Oberfläche (POS)
  - `/device/customer` – das Kundendisplay, das live den Warenkorb einer verknüpften Kasse spiegelt
  - `/device/station` – das Standort-Display für Küche, Bar oder Ausgabe
  - `/device/register` – die Registrierungsseite, über die ein neues Gerät per QR-Code/Link an eine Organisation gekoppelt wird

## Tech Stack

- **Framework:** Next.js 15 (App Router, Turbopack)
- **UI:** React 19 + Untitled UI Komponenten
- **Sprache:** TypeScript 5.x
- **Styling:** TailwindCSS 4.x
- **State Management:** TanStack Query + Zustand
- **Forms:** React Hook Form + Zod
- **i18n:** next-intl (DE/EN)
- **Theme:** next-themes (Dark/Light Mode)
- **Error Tracking:** Sentry
- **Components:** react-aria-components

## Setup

```bash
# Dependencies installieren
pnpm install

# Development Server starten
pnpm dev

# Production Build
pnpm build

# Linting
pnpm lint
```

## Entwicklungs-Hilfen

### Drucker-Agent simulieren

`scripts/dev/printer-agent-sim.mjs` spielt einen Drucker-Agent nach, damit sich die Seite
„Drucker“ ohne echten Drucker und ohne den Python-Agent testen lässt. Das Skript registriert sich
als `printer_agent` (`POST /devices/init`), zeigt den 6-stelligen Kopplungscode, verbindet sich nach
dem Verknüpfen per Socket (Device-Token), schickt `agentHeartbeat`, meldet ein paar gefundene
Drucker (USB, Netzwerk, bei `--os windows` auch Spooler) an `POST /device-api/printers/discovered`
und reagiert auf `printerDiscover`, `printerConfigUpdate` und `printerJob`.

```bash
# API lokal unter http://localhost:3001 (ohne /api)
node scripts/dev/printer-agent-sim.mjs --api http://localhost:3001 --name "Drucker-Agent Küche"

# Als Windows-Agent (meldet zusätzlich einen Spooler-Drucker); --reset vergisst das gespeicherte Gerät
node scripts/dev/printer-agent-sim.mjs --os windows --reset
```

Der Device-Token landet in `.printer-agent-sim.json` (ignoriert von Git), ein Neustart nutzt
denselben Agent. Danach in der Web-App: Drucker → „Drucker-Agent verbinden“ → Code eingeben →
gefundene Drucker übernehmen, Testdruck auslösen (der Simulator bestätigt Jobs nach kurzer Zeit).

### Assistent ohne echtes Modell testen

`scripts/dev/fake-openai.mjs` ist ein winziger OpenAI-kompatibler Server: Er beantwortet
`POST /v1/chat/completions` mit einer festen Speisekarte (Schema `menu_extraction` der API) bzw.
einer Icon-Auswahl, ohne ein Modell zu fragen. Damit lassen sich Einstellungen → Assistent, „Aus
Speisekarte importieren“ und der Icon-Vorschlag im Produktformular ohne Schlüssel durchspielen.

```bash
# Fake-Anbieter starten (Port 4010; --delay 1500 verzögert die Antwort, --fail liefert 500)
node scripts/dev/fake-openai.mjs

# API (openeos-api) dagegen laufen lassen
AI_PROVIDER=openai OPENAI_API_KEY=fake OPENAI_BASE_URL=http://localhost:4010/v1 pnpm dev
```

Zur Laufzeit: `GET /fail/on` bzw. `/fail/off` schaltet den Fehlerfall um. Enthält der eingefügte
Text das Wort „leer“, kommt ein Vorschlag ohne Produkte zurück, „kaputt“ erzeugt einen
Anbieterfehler (Import `failed`). PDFs lehnt der OpenAI-kompatible Anbieter der API grundsätzlich
ab — dafür Bilder hochladen.

## Projektstruktur

```
src/
├── app/                    # Next.js App Router
│   ├── [locale]/           # i18n locale routing
│   │   ├── (auth)/         # Auth-Routen (Login, Register, etc.)
│   │   └── layout.tsx      # Root Layout
│   └── layout.tsx          # HTML Root
├── components/
│   ├── foundations/        # Logo, Icons
│   ├── providers/          # React Providers
│   └── ui/                 # Untitled UI Komponenten
├── hooks/                  # Custom React Hooks
├── i18n/                   # i18n Konfiguration
├── lib/                    # API Client, Utilities
├── messages/               # i18n Übersetzungen (de.json, en.json)
├── stores/                 # Zustand Stores
├── styles/                 # Global CSS, Theme
├── types/                  # TypeScript Types
└── middleware.ts           # i18n Middleware
```

## Environment Variables

Kopiere `.env.example` nach `.env.local`:

```bash
cp .env.example .env.local
```

Variablen:

| Variable | Beschreibung |
|----------|--------------|
| `NEXT_PUBLIC_API_URL` | URL der OpenEOS API |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN (Client) |
| `SENTRY_DSN` | Sentry DSN (Server) |
| `SENTRY_ORG` | Sentry Organisation |
| `SENTRY_PROJECT` | Sentry Projekt |

## Docker Deployment

### Mit Docker Compose (Production)

```bash
# Image von GHCR pullen und starten
docker compose -f docker-compose.prod.yml up -d
```

### Lokaler Build

```bash
# Lokal bauen und starten
docker compose up -d --build
```

Das Image wird mit Traefik-Labels für automatisches SSL konfiguriert.
Erwartet ein externes Docker-Netzwerk `frontend`.

## GitHub Actions / CI/CD

Der Workflow `.github/workflows/docker-build.yml` baut automatisch Docker Images und pusht sie zu GitHub Container Registry (GHCR).

### Trigger

- Push auf `main` Branch
- Tags mit `v*` (z.B. `v1.0.0`)
- Pull Requests (nur Build, kein Push)

### Konfiguration

Folgende Werte müssen im GitHub Repository konfiguriert werden:

**Repository → Settings → Secrets and variables → Actions**

#### Secrets

| Secret | Beschreibung |
|--------|--------------|
| `SENTRY_AUTH_TOKEN` | Sentry Auth Token für Source Maps Upload. Erstellen unter: Sentry → Settings → Auth Tokens (Scopes: `project:releases`, `org:read`) |

#### Variables

| Variable | Beispielwert | Beschreibung |
|----------|--------------|--------------|
| `NEXT_PUBLIC_API_URL` | `https://api.openeos.de` | API URL (optional, Default bereits gesetzt) |
| `NEXT_PUBLIC_SENTRY_DSN` | `https://xxx@o123.ingest.sentry.io/456` | Sentry DSN für Client-seitiges Error Tracking |
| `SENTRY_ORG` | `openeos` | Sentry Organisations-Slug |
| `SENTRY_PROJECT` | `openeos-web` | Sentry Projekt-Slug |

### Image Tags

Das CI erstellt automatisch folgende Tags:

| Event | Tag Beispiele |
|-------|---------------|
| Push auf `main` | `latest`, `main`, `<sha>` |
| Tag `v1.2.3` | `1.2.3`, `1.2`, `1`, `<sha>` |
| Pull Request | `pr-123` (nur Build, kein Push) |

### Image verwenden

```bash
docker pull ghcr.io/openeos-project/openeos-web:latest
```

## Automatisches Deployment

Nach jedem erfolgreichen Image-Build auf `main` kann derselbe Workflow (`.github/workflows/docker-build.yml`, Job `deploy`) automatisch auf den Produktionsserver deployen. Der Deploy-Job ist standardmäßig deaktiviert und muss explizit aktiviert werden.

**Aktivieren:** Repository-Variable `DEPLOY_ENABLED` auf `true` setzen (Settings → Secrets and variables → Actions → Variables).

**Benötigte Variables:**

| Variable | Beschreibung |
|----------|--------------|
| `DEPLOY_ENABLED` | `true` aktiviert den Deploy-Job, sonst wird er übersprungen |
| `DEPLOY_PATH` | Optional — Compose-Verzeichnis auf dem Server (Default: `/srv/docker/<repo-name>`) |
| `DEPLOY_SERVICE` | Optional — Compose-Dienst (Default: der Dienst mit dem Image dieses Repos) |
| `DEPLOY_GUARD_URL` | Optional — Deploy-Schutz-Endpunkt (Default: `https://api.openeos.de/api/internal/deploy-guard`) |

**Benötigte Secrets:**

| Secret | Beschreibung |
|--------|--------------|
| `DEPLOY_HOST` | Hostname/IP des Produktionsservers |
| `DEPLOY_USER` | SSH-Benutzer |
| `DEPLOY_SSH_KEY` | Privater SSH-Key für den Zugriff |
| `DEPLOY_PORT` | (optional) SSH-Port, Standard: `22` |
| `DEPLOY_GUARD_TOKEN` | Token des Deploy-Schutzes (wie in der `.env` der Produktions-API); ohne ihn wird die Prüfung mit Warnung übersprungen |

Ablauf:

1. **Deploy-Schutz** (nur Produktion, Composite Action
   `OpenEOS-Project/.github/actions/deploy-guard`): läuft gerade ein Fest —
   eine aktive Veranstaltung mit echten Bestellungen in den letzten
   30 Minuten —, wartet der Job, fragt alle 5 Minuten erneut und bricht nach
   90 Minuten ab. Übergehen: „Run workflow“ auf `main` mit `force: true`.
2. Per SSH: `docker compose pull <dienst>`, dann **`docker rollout <dienst>`**
   ([docker-rollout](https://github.com/wowu/docker-rollout)): neue Instanzen
   starten neben den alten, bekommen erst Verkehr, wenn ihr Health-Check
   (`/api/health`) grün ist; die alten werden über `/tmp/drain` aus dem Proxy
   genommen und dann gestoppt. Werden die neuen nicht gesund, laufen die alten
   weiter und das vorige Image bekommt sein Tag zurück. Ohne `docker rollout`
   auf dem Server: `docker compose up -d` wie bisher.
3. `docker image prune -f`.

**Health-Check:** `GET /api/health` antwortet 200, sobald der Next-Server läuft
(ohne API-Aufruf). **Herunterfahren:** Auf SIGTERM nimmt Next.js keine neuen
Verbindungen mehr an, lässt laufende Anfragen zu Ende laufen und beendet sich.

## Lizenz

Copyright (C) 2026 LUXCODE by Lukas Lukic-Spitznagel und Mitwirkende.

Lizenziert unter der GNU Affero General Public License v3.0 oder (nach deiner Wahl) jeder späteren Version (`AGPL-3.0-or-later`), siehe [LICENSE](LICENSE) und [NOTICE](NOTICE). Enthaltene Fremdbestandteile (u. a. Untitled-UI-Komponenten, MIT) stehen in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

**Quellcode-Link (AGPL § 13):** Anmeldung, Einstellungen und das Kassenmenü verlinken den Quellcode. Ziel ist `SOURCE_URL` (Laufzeit, Rückfall `NEXT_PUBLIC_SOURCE_URL` aus dem Build, Standard `https://github.com/OpenEOS-Project`). Wer eine geänderte Fassung betreibt, setzt die Variable auf das eigene Repository.
