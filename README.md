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

## Dokumentation

Siehe [PLAN/05-FRONTEND.md](../PLAN/05-FRONTEND.md)

## License

AGPLv3