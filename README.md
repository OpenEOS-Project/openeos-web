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
| `DEPLOY_PATH` | Pfad zum `docker-compose.yml` auf dem Zielserver |
| `DEPLOY_SERVICE` | Name des zu aktualisierenden Compose-Service |

**Benötigte Secrets:**

| Secret | Beschreibung |
|--------|--------------|
| `DEPLOY_HOST` | Hostname/IP des Produktionsservers |
| `DEPLOY_USER` | SSH-Benutzer |
| `DEPLOY_SSH_KEY` | Privater SSH-Key für den Zugriff |
| `DEPLOY_PORT` | (optional) SSH-Port, Standard: `22` |

Der Deploy-Job verbindet sich per SSH auf den Server und führt dort `docker compose pull` + `docker compose up -d` für den konfigurierten Service aus, gefolgt von `docker image prune -f`.

## License

AGPLv3
