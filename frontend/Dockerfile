# syntax=docker/dockerfile:1
# Frontend image, built from the repo root (see infrastructure/docker-compose.yaml). Targets:
#   build  full install + `next build` (output: standalone); never shipped
#   web    Next.js standalone server only (design N2b §3.3)

FROM node:26.6.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY frontend frontend
# `next build` type-checks frontend/test, which imports the backend domain and schema files.
COPY backend backend
# next.config.ts bakes this into the rewrites at build time: change it, then rebuild.
ARG BACKEND_URL=http://api:4000
ENV BACKEND_URL=${BACKEND_URL}
RUN npm run build -w frontend

FROM node:26.6.0-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# The standalone tree mirrors the monorepo: server.js sits in frontend/ next to a pruned node_modules.
COPY --chown=node:node --from=build /app/frontend/.next/standalone ./
COPY --chown=node:node --from=build /app/frontend/.next/static frontend/.next/static
USER node
EXPOSE 3000
CMD ["node", "frontend/server.js"]
