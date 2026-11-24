#!/bin/sh
# Backend start: backup before pending migrations, apply them, then run the server.
#
# A dump is made only when a migration is about to be applied to a database that already holds data,
# so ordinary restarts never create dumps (and never push a pre-migration dump out of the kept set).
# Pending = migration folders in prisma/migrations > finished rows in _prisma_migrations.
# libpq connects through PGHOST/PGUSER/PGPASSWORD/PGDATABASE (set by docker-compose), not DATABASE_URL,
# because DATABASE_URL carries Prisma-only options such as connection_limit that libpq rejects.
#
# Overridable for tests: BACKUP_DIR, BACKUP_KEEP, MIGRATIONS_DIR, MIGRATE_CMD, SERVER_CMD.
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_KEEP="${BACKUP_KEEP:-10}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-prisma/migrations}"
MIGRATE_CMD="${MIGRATE_CMD:-prisma migrate deploy}"
SERVER_CMD="${SERVER_CMD:-node dist/server.js}"

n_files=$(find "$MIGRATIONS_DIR" -mindepth 1 -maxdepth 1 -type d | wc -l)
# Any psql failure stops the start: we must not guess whether a migration is pending.
has_table=$(psql -v ON_ERROR_STOP=1 -tAc "SELECT to_regclass('_prisma_migrations')")
n_applied=0
if [ -n "$has_table" ]; then
  n_applied=$(psql -v ON_ERROR_STOP=1 -tAc "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL")
fi

mkdir -p "$BACKUP_DIR"
# Leftovers of an interrupted dump are never valid backups.
rm -f "$BACKUP_DIR"/*.partial

if [ "$n_files" -gt "$n_applied" ] && [ -n "$has_table" ]; then
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  target="$BACKUP_DIR/pre-migrate-$stamp.dump"
  echo "start-prod: $((n_files - n_applied)) pending migration(s); dumping to $target"
  # Written as .partial and renamed only on success, so a half-written dump never looks like a backup.
  if ! pg_dump -Fc -f "$target.partial"; then
    rm -f "$target.partial"
    echo "start-prod: backup failed; refusing to migrate without a backup" >&2
    exit 1
  fi
  mv "$target.partial" "$target"
fi

# Keep the newest BACKUP_KEEP dumps. No pipefail in sh: an empty listing must not fail the script.
ls -1t "$BACKUP_DIR"/pre-migrate-*.dump 2>/dev/null | tail -n +$((BACKUP_KEEP + 1)) | xargs -r rm --

# shellcheck disable=SC2086 # word splitting of the command is intended
$MIGRATE_CMD
# shellcheck disable=SC2086
exec $SERVER_CMD
