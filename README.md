# OpenEOS Web

Admin-Dashboard und Kassen-UI für OpenEOS.

## Features

- Admin-Dashboard für Organisationen
- Mobile Kassen-UI (PWA)
- Event-Verwaltung
- Produkt- und Kategorie-Management
- Bestellübersicht
- Statistiken & Berichte

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

> **Hinweis:** `GITHUB_TOKEN` wird automatisch von GitHub bereitgestellt.

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

## License

AGPLv3
