# syntax=docker/dockerfile:1
# Two targets, built from the repo root (see infrastructure/docker-compose.yaml):
#   api  Express API (also runs the migrate + seed one-shot)
#   web  Next.js frontend
# Debian slim, not Alpine: Prisma's schema engine is a glibc/OpenSSL binary (design N2 §N2.3).

FROM node:26.6.0-bookworm-slim AS base
WORKDIR /app
# openssl: Prisma detects the OpenSSL version at runtime; the slim image ships without it.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && chown node:node /app
USER node

# Exact lockfile install, both workspaces. devDependencies stay: the API runs through tsx and
# migrate needs the prisma CLI.
FROM base AS deps
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node backend/package.json backend/package.json
COPY --chown=node:node frontend/package.json frontend/package.json
RUN npm ci

FROM deps AS api
COPY --chown=node:node backend backend
COPY --chown=node:node database database
RUN npm run db:generate -w backend
ENV NODE_ENV=production \
    PORT=4000
EXPOSE 4000
CMD ["npm", "run", "start", "-w", "backend"]

FROM deps AS web
COPY --chown=node:node frontend frontend
# `next build` type-checks frontend/test, which imports the backend domain and schema files.
COPY --chown=node:node backend backend
# next.config.ts bakes this into the rewrites at build time: change it, then rebuild.
ARG BACKEND_URL=http://api:4000
ENV BACKEND_URL=${BACKEND_URL}
RUN npm run build -w frontend
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "frontend"]
