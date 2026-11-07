#!/usr/bin/env bash
# Daily backup of the production stack (docs/OPERACAO.md section 5). Writes one dated folder with:
#   db.dump          pg_dump custom format (compressed)
#   counts.tsv       rows per table, taken in the same snapshot as the dump (checked by restore-test.sh)
#   storage.tar.gz   the photos of the storage volume (skipped with BACKUP_STORAGE=none, e.g. STORAGE_DRIVER=s3)
#   SHA256SUMS
# then deletes local folders older than BACKUP_RETENTION_DAYS and, only when BACKUP_RCLONE_REMOTE is set, copies the
# new folder off the server with rclone (any rclone remote: S3 compatible, R2, B2, Drive...).
#
# Settings: environment variables, or BACKUP_* lines of infra/.env.production (the environment wins):
#   BACKUP_COMPOSE          compose command of the stack
#                           (default: docker compose -f infra/compose.production.yaml --env-file infra/.env.production)
#   BACKUP_DIR              where the dated folders go (default: backups, relative to the repository root)
#   BACKUP_RETENTION_DAYS   local retention in days (default: 30)
#   BACKUP_STORAGE          volume (default) or none
#   BACKUP_RCLONE_REMOTE    rclone destination, e.g. offsite:refrigeracao-castro-backups (default: empty, no copy)
#   BACKUP_RCLONE_ENV_FILE  env file with the RCLONE_CONFIG_<REMOTE>_* settings of that remote
# Usage: infra/backup/backup.sh (prints the folder it wrote on the last line)
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$SCRIPT_DIR/../.."

# Takes the BACKUP_* lines of the production env file, without overriding what the environment already set.
load_env_file() {
  local file=infra/.env.production line name
  if [ ! -f "$file" ]; then return; fi
  while IFS= read -r line; do
    name=${line%%=*}
    if [ -z "${!name:-}" ]; then export "${line?}"; fi
  done < <(grep -E '^BACKUP_[A-Z_]+=' "$file" || true)
}

load_env_file
COMPOSE=${BACKUP_COMPOSE:-docker compose -f infra/compose.production.yaml --env-file infra/.env.production}
BACKUP_DIR=${BACKUP_DIR:-backups}
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
RCLONE_IMAGE=rclone/rclone:1.75.2
COUNTS_IN_CONTAINER=/tmp/backup_counts.tsv
TARGET="$BACKUP_DIR/$(date +%Y%m%d_%H%M%S)"

# The counts and the dump share one REPEATABLE READ snapshot, so they agree even while the site is writing.
# psql runs pg_dump itself (\!) while the transaction that exported the snapshot is still open.
dump_script() {
  cat <<SQL
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT pg_export_snapshot() AS snapshot \gset
\setenv BACKUP_SNAPSHOT :snapshot
\o $COUNTS_IN_CONTAINER
$(cat "$SCRIPT_DIR/row-counts.sql")
\o
\! pg_dump --username="\$POSTGRES_USER" --dbname="\$POSTGRES_DB" --format=custom --snapshot="\$BACKUP_SNAPSHOT"
COMMIT;
SQL
}

# The variables expand inside the postgres container, not here.
# shellcheck disable=SC2016
dump_database() {
  dump_script | $COMPOSE exec -T postgres sh -c \
    'psql --quiet --no-psqlrc --tuples-only --no-align --field-separator="	" --set=ON_ERROR_STOP=1 \
      --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' >"$TARGET/db.dump"
  $COMPOSE exec -T postgres sh -c "cat $COUNTS_IN_CONTAINER && rm $COUNTS_IN_CONTAINER" >"$TARGET/counts.tsv"
}

archive_storage() {
  if [ "${BACKUP_STORAGE:-volume}" = none ]; then return; fi
  $COMPOSE exec -T api tar -czf - -C /data/storage . >"$TARGET/storage.tar.gz"
}

write_checksums() {
  (cd "$TARGET" && sha256sum -- * >SHA256SUMS)
}

prune_old_backups() {
  find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*' -mtime "+$RETENTION_DAYS" -exec rm -r {} +
}

copy_off_server() {
  if [ -z "${BACKUP_RCLONE_REMOTE:-}" ]; then
    echo 'BACKUP_RCLONE_REMOTE not set: the backup stays only on this server.' >&2
    return
  fi
  local name
  name=$(basename "$TARGET")
  docker run --rm --env-file "${BACKUP_RCLONE_ENV_FILE:?set BACKUP_RCLONE_ENV_FILE}" \
    --volume "$(cd "$TARGET" && pwd):/backup:ro" "$RCLONE_IMAGE" copy /backup "$BACKUP_RCLONE_REMOTE/$name"
}

mkdir -p "$TARGET"
dump_database
archive_storage
write_checksums
prune_old_backups
copy_off_server
echo "$TARGET"
