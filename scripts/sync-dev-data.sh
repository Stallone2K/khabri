#!/usr/bin/env bash
# Copy production signal data (read-only) from the VPS into the local dev
# PostGIS container for realistic development. Copies only columns that exist
# on BOTH sides, so schema drift between prod and the v08.2026 branch is safe.
#
# Usage: bash scripts/sync-dev-data.sh
set -euo pipefail

SSH_HOST="ShowNoMore"
REMOTE_PSQL="sudo -u postgres psql -d khabri -t -A"
LOCAL_PSQL="docker exec -i khabri-postgis psql -U khabri -d khabri_dev"

# table:excluded-columns (comma-separated; excluded = re-derived locally)
TABLES=(
  "Signal:"
  "SignalEntity:"
  "SignalKeyword:"
  "SignalLocation:locationId,lat,lng,h3Cell"
)

for entry in "${TABLES[@]}"; do
  T="${entry%%:*}"
  EXCLUDE="${entry#*:}"

  remote_cols=$(ssh "$SSH_HOST" "$REMOTE_PSQL -c \"SELECT column_name FROM information_schema.columns WHERE table_name='$T'\"" | sort)
  local_cols=$($LOCAL_PSQL -t -A -c "SELECT column_name FROM information_schema.columns WHERE table_name='$T'" | sort)
  common=$(comm -12 <(echo "$remote_cols") <(echo "$local_cols"))

  if [ -n "$EXCLUDE" ]; then
    common=$(echo "$common" | grep -vxF -f <(echo "$EXCLUDE" | tr ',' '\n'))
  fi
  collist=$(echo "$common" | awk 'NF {printf "%s\"%s\"", sep, $0; sep=","}')
  [ -n "$collist" ] || { echo "no common columns for $T, skipping"; continue; }

  echo "[SYNC] $T (${collist//\"/})"
  $LOCAL_PSQL -c "TRUNCATE \"$T\" CASCADE" >/dev/null
  ssh "$SSH_HOST" "$REMOTE_PSQL -c '\\copy (SELECT $collist FROM \"$T\") TO STDOUT'" \
    | $LOCAL_PSQL -c "\\copy \"$T\"($collist) FROM STDIN" >/dev/null
  count=$($LOCAL_PSQL -t -A -c "SELECT count(*) FROM \"$T\"")
  echo "[SYNC] $T: $count rows"
done

echo "[SYNC] done"
