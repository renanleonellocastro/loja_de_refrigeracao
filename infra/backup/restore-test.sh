#!/usr/bin/env bash
# Restore test of one folder written by backup.sh (docs/OPERACAO.md section 5). Never touches the stack:
#   1. checks SHA256SUMS;
#   2. restores db.dump into a fresh PostgreSQL container of its own;
#   3. compares the rows of every table with counts.tsv, taken in the same snapshot as the dump;
#   4. takes one random photo from the restored media table and checks that storage.tar.gz holds its
#      original as a real WebP file.
# Exits non zero on any difference. Usage: infra/backup/restore-test.sh <backup folder>
set -euo pipefail

BACKUP=${1:?usage: restore-test.sh <backup folder>}
CONTAINER=${RESTORE_TEST_CONTAINER:-rc-restore-test}
IMAGE=postgres:17-alpine
SQL_DIR=$(cd "$(dirname "$0")" && pwd)
WORK=$(mktemp -d)
trap 'docker rm --force "$CONTAINER" >/dev/null 2>&1 || true; rm -r "$WORK"' EXIT

sql() {
  docker exec -i "$CONTAINER" psql --quiet --no-psqlrc --tuples-only --no-align --field-separator="	" \
    --set=ON_ERROR_STOP=1 --username=castro --dbname=castro "$@"
}

check_checksums() {
  (cd "$BACKUP" && sha256sum --check --quiet SHA256SUMS)
}

start_database() {
  docker run --detach --rm --name "$CONTAINER" --env POSTGRES_USER=castro --env POSTGRES_PASSWORD=restore-test \
    --env POSTGRES_DB=castro "$IMAGE" >/dev/null
  until docker exec "$CONTAINER" pg_isready --host=127.0.0.1 --username=castro >/dev/null 2>&1; do sleep 1; done
}

restore_dump() {
  docker exec -i "$CONTAINER" pg_restore --username=castro --dbname=castro --no-owner --exit-on-error <"$BACKUP/db.dump"
}

compare_counts() {
  sql <"$SQL_DIR/row-counts.sql" >"$WORK/restored.tsv"
  if ! diff "$BACKUP/counts.tsv" "$WORK/restored.tsv"; then
    echo 'restore test FAILED: row counts differ (left: backup, right: restored)' >&2
    return 1
  fi
  echo "row counts match: $(wc -l <"$WORK/restored.tsv" | tr -d ' ') tables, $(awk '{s += $2} END {print s}' "$WORK/restored.tsv") rows"
}

check_sample_photo() {
  local key photo
  key=$(sql --command='SELECT storage_key FROM media ORDER BY random() LIMIT 1')
  if [ -z "$key" ]; then echo 'no photos in the backup: photo check skipped'; return; fi
  if [ ! -f "$BACKUP/storage.tar.gz" ]; then echo 'no storage.tar.gz (photos in S3): photo check skipped'; return; fi
  photo="./$key/original.webp"
  tar -xzf "$BACKUP/storage.tar.gz" -C "$WORK" "$photo"
  if [ "$(head -c 4 "$WORK/$photo")" != RIFF ] || [ "$(tail -c +9 "$WORK/$photo" | head -c 4)" != WEBP ]; then
    echo "restore test FAILED: $photo is not a WebP file" >&2
    return 1
  fi
  echo "sample photo ok: $photo ($(wc -c <"$WORK/$photo" | tr -d ' ') bytes)"
}

check_checksums
start_database
restore_dump
compare_counts
check_sample_photo
echo "restore test OK: $BACKUP"
