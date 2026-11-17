# syntax=docker/dockerfile:1
# Backend image, built from the repo root (see infrastructure/docker-compose.yaml). Targets:
#   api    Express server: runtime dependencies + backend source only (design N2b §3.2)
#   tools  migrate + seed one-shot: keeps the Prisma CLI and database/, runs once then exits
# Debian slim, not Alpine: Prisma's schema engine is a glibc/OpenSSL binary (design N2 §N2.3).

FROM node:26.6.0-bookworm-slim AS base
WORKDIR /app
# openssl: Prisma detects the OpenSSL version at runtime; the slim image ships without it.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && chown node:node /app
USER node

# Workspace manifests: npm ci reads every workspace's package.json to match the root lockfile.
FROM base AS manifests
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node backend/package.json backend/package.json
COPY --chown=node:node frontend/package.json frontend/package.json

FROM manifests AS build
RUN npm ci -w backend
COPY --chown=node:node backend backend
COPY --chown=node:node database database
RUN npm run db:generate -w backend

FROM manifests AS prod-deps
# @prisma/client lists the prisma CLI as a peer dependency, and backend also has it as a
# devDependency, so `--omit=dev` still installs it with Studio, React and more (~200 MB). The
# server only needs the already generated client: uninstall the CLI, then delete what npm now
# reports as extraneous (only the CLI needed it). `npm prune` is no use here: it re-installs the
# frontend workspace. typescript is an optional peer of @prisma/client that npm keeps; the server
# runs through tsx (esbuild) and never loads it.
RUN npm ci -w backend --omit=dev \
    && npm uninstall prisma -w backend --no-save --omit=dev --ignore-scripts \
    && npm query ':extraneous' \
    | node -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>{for(const p of JSON.parse(s))if(p.location.startsWith("node_modules/"))require("fs").rmSync(p.path,{recursive:true,force:true})})' \
    && rm -rf node_modules/typescript

FROM build AS tools
ENV NODE_ENV=production
CMD ["sh", "-c", "npm run db:migrate -w backend && npm run db:seed -w backend"]

FROM base AS api
COPY --chown=node:node --from=prod-deps /app/node_modules node_modules
COPY --chown=node:node --from=build /app/backend backend
ENV NODE_ENV=production \
    PORT=4000
EXPOSE 4000
# node directly (not npm): SIGTERM reaches the server, which shuts down gracefully.
WORKDIR /app/backend
CMD ["node", "--import", "tsx", "index.ts"]
