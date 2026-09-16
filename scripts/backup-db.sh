#!/usr/bin/env bash
set -euo pipefail

# Nightly pg_dump of the Neon database (docs/11-deployment.md §7).
# Skips cleanly when DATABASE_URL is not configured (e.g. early dev).
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL not set — skipping backup" >&2
  exit 0
fi

mkdir -p .backup
TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT=".backup/threadcap-$TS.sql.gz"
echo "Dumping database to $OUT"
pg_dump "$DATABASE_URL" --no-owner --no-acl | gzip > "$OUT"
echo "Backup complete: $(du -h "$OUT" | cut -f1)"