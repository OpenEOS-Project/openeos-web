FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.16.0 --activate

# Dependencies stage
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set build-time environment variables
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_VERSION=dev
ARG NEXT_PUBLIC_SHOP_URL=https://shop.openeos.de
ARG NEXT_PUBLIC_SENTRY_DSN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_AUTH_TOKEN

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION
ENV NEXT_PUBLIC_SHOP_URL=$NEXT_PUBLIC_SHOP_URL
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV SENTRY_ORG=$SENTRY_ORG
ENV SENTRY_PROJECT=$SENTRY_PROJECT
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN

RUN pnpm build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# /api/health antwortet, sobald der Server laeuft (ohne API, ohne Rendern).
# 127.0.0.1 statt localhost: localhost zeigt im Container zuerst auf ::1,
# der Server lauscht aber nur auf IPv4.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -q -T 3 -O /dev/null http://127.0.0.1:3000/api/health || exit 1

# SIGTERM (docker stop): Next.js nimmt keine neuen Verbindungen mehr an,
# laesst laufende Anfragen zu Ende laufen und beendet sich dann
# (next/dist/server/lib/start-server.js). Keine eigene Signalbehandlung noetig.
STOPSIGNAL SIGTERM
CMD ["node", "server.js"]
