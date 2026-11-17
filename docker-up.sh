#!/usr/bin/env bash
# docker-up.sh: build and start PostgreSQL, migrate + seed, API and web (profile "app").
set -euo pipefail
cd "$(dirname "$0")"
docker compose -f infrastructure/docker-compose.yaml --profile app up -d --build --wait "$@"
echo "G-Scores: http://localhost:${WEB_PORT:-3000}  (API http://localhost:${API_PORT:-4000}/api/health)"
