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
# npm ci honours package-lock.json exactly and runs lifecycle scripts by
# default, so the unrs-resolver postinstall (needed for eslint/next resolution
# at build time) runs without extra flags. (The `allowScripts` key in
# package.json is a pnpm/lavamoat concept; npm ignores it.)
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

# The same image also runs the migration entrypoint (`node scripts/migrate.mjs`),
# invoked by the Helm pre-upgrade hook and the CI smoke job. The Next.js
# standalone trace only bundles the web server's runtime deps, so the migrate
# script, the migrations folder and the two packages the script imports are
# copied in explicitly. The script hardcodes the `./drizzle` migrations folder,
# so drizzle.config.ts (which pulls in the drizzle-kit devDependency) is not
# needed at runtime. `postgres` and `drizzle-orm` have no hard runtime
# dependencies of their own, so copying just these two from the fully-installed
# deps stage is enough and keeps the image small.
COPY --from=builder --chown=1001:1001 /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder --chown=1001:1001 /app/drizzle ./drizzle
COPY --from=deps --chown=1001:1001 /app/node_modules/postgres ./node_modules/postgres
COPY --from=deps --chown=1001:1001 /app/node_modules/drizzle-orm ./node_modules/drizzle-orm

USER 1001
EXPOSE 3000

CMD ["node", "server.js"]
