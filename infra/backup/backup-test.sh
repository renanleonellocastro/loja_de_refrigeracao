#!/usr/bin/env bash
# End to end check of backup.sh and restore-test.sh against a throwaway stack (docs/OPERACAO.md section 5):
# builds the API image, starts PostgreSQL and the API (which applies the migrations), fills the database and the
# storage volume with the development seed (sample products with photos, orders, quotes), takes a backup and
# restores it into a fresh database. Removes the stack and its volumes at the end. Needs `pnpm install` and the
# shared packages built (`make packages`). Usage: infra/backup/backup-test.sh
set -euo pipefail

cd "$(dirname "$0")/../.."
PROJECT=${BACKUP_TEST_PROJECT:-refrigeracao-castro-backup-test}
export BACKUP_TEST_POSTGRES_PORT=${BACKUP_TEST_POSTGRES_PORT:-5487}
COMPOSE="docker compose --project-name $PROJECT --env-file infra/backup/test.env
  -f infra/compose.production.yaml -f infra/backup/compose.backup-test.yaml"
WORK=$(mktemp -d)
trap '$COMPOSE down --volumes --remove-orphans >/dev/null 2>&1; rm -r "$WORK"' EXIT

start_stack() {
  $COMPOSE up --detach --build --wait postgres api
}

# The seed refuses NODE_ENV=production, so it runs from the sources on the host and its photos are copied into the
# storage volume afterwards, keeping the paths the API uses.
seed_sample_data() {
  NODE_ENV=development DATABASE_URL="postgres://castro:backup-test-only@localhost:$BACKUP_TEST_POSTGRES_PORT/castro" \
    STORAGE_PATH="$WORK/storage" pnpm --filter @rc/api seed
  $COMPOSE cp "$WORK/storage/." api:/data/storage
}

run_backup_and_restore() {
  local folder
  folder=$(BACKUP_COMPOSE="$COMPOSE" BACKUP_DIR="$WORK/backups" infra/backup/backup.sh | tail -n 1)
  ls -l "$folder"
  infra/backup/restore-test.sh "$folder"
}

start_stack
seed_sample_data
run_backup_and_restore
