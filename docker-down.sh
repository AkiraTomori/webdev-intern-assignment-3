#!/usr/bin/env bash
# docker-down.sh: stop and remove the containers. Data stays in the pgdata volume.
set -euo pipefail
cd "$(dirname "$0")"
docker compose -f infrastructure/docker-compose.yaml --profile app down
