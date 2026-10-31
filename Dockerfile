# syntax=docker/dockerfile:1

# One image for the Next.js web app, migrations and the fetch job.
# Multi-stage build: install deps, build the standalone output, then run it
# from a minimal non-root image. See .kiro/steering/tech.md and deploy.md.

# Pinned base image. node:22-alpine is the current LTS line; the tag is pinned
# to an exact minor and never :latest.
FROM node:22.14-alpine AS base

# --- deps: install exactly what package-lock.json resolves -------------------
FROM base AS deps
WORKDIR /app
# Only the manifests, so this layer caches until dependencies change.
COPY package.json package-lock.json ./
# npm ci honours package-lock.json exactly. allowScripts in package.json lets
# the unrs-resolver postinstall run, which eslint/next resolution needs.
RUN npm ci

# --- builder: compile the app and emit .next/standalone -----------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# APP_VERSION flows into `next build` and the version lib so the built app
# reports the right version.
ARG APP_VERSION
ENV APP_VERSION=$APP_VERSION
# output: "standalone" and outputFileTracingRoot are set in next.config.ts.
RUN npm run build

# --- runner: minimal image with only the standalone artifacts -----------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Re-declare so the running container reports the right version.
ARG APP_VERSION
ENV APP_VERSION=$APP_VERSION

# Non-root user/group with UID/GID 1001.
RUN addgroup -g 1001 -S nodejs \
  && adduser -u 1001 -S nextjs -G nodejs

# server.js lands at /app/server.js because outputFileTracingRoot is the
# project root. Copy only the standalone bundle and static assets, chowned
# to the non-root user. There is no public/ dir in this scaffold; add its
# COPY here when one is introduced.
COPY --from=builder --chown=1001:1001 /app/.next/standalone ./
COPY --from=builder --chown=1001:1001 /app/.next/static ./.next/static

USER 1001
EXPOSE 3000

CMD ["node", "server.js"]
