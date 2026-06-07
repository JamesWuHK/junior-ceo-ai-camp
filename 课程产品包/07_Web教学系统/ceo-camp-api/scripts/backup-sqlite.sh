#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-/opt/ceo-camp-api}"
DB_PATH="${DB_PATH:-$APP_DIR/data/camp.db}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_PATH" ]; then
  echo "database not found: $DB_PATH"
  exit 0
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/camp-$STAMP.db'"
else
  cp "$DB_PATH" "$BACKUP_DIR/camp-$STAMP.db"
fi
gzip -f "$BACKUP_DIR/camp-$STAMP.db"
find "$BACKUP_DIR" -name "camp-*.db.gz" -mtime +"$KEEP_DAYS" -delete

echo "backup created: $BACKUP_DIR/camp-$STAMP.db.gz"
