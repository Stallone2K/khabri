#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# setup-gcp-cron.sh — Create Google Cloud Scheduler jobs for Khabri cron routes
#
# Prerequisites:
#   1. gcloud CLI installed and authenticated
#   2. CRON_SECRET env var set (same value as in Cloud Run)
#   3. APP_URL env var set (e.g. https://khabri.shownomore.com)
#
# Usage:
#   APP_URL=https://khabri.shownomore.com CRON_SECRET=your-secret ./scripts/setup-gcp-cron.sh
#
# To delete all jobs:
#   ./scripts/setup-gcp-cron.sh --delete
# ---------------------------------------------------------------------------

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────
APP_URL="${APP_URL:?'APP_URL is required (e.g. https://khabri.shownomore.com)'}"
CRON_SECRET="${CRON_SECRET:?'CRON_SECRET is required'}"
GCP_LOCATION="${GCP_LOCATION:-asia-south1}"  # Default to Mumbai, change as needed
GCP_PROJECT="${GCP_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
TIMEZONE="Asia/Kolkata"

# ── Cron Jobs Definition ────────────────────────────────────────────────────
# Format: "job-name|schedule|path|method"
# All main jobs run every 3 hours; webhook-deliver runs every 5 minutes
JOBS=(
  "khabri-ingest|0 */3 * * *|/api/cron/ingest|POST"
  "khabri-enrich|20 */3 * * *|/api/cron/enrich|POST"
  "khabri-anomaly|40 */3 * * *|/api/cron/anomaly|POST"
  "khabri-trend-monitor|50 */3 * * *|/api/cron/trend-monitor|POST"
  "khabri-usage-aggregate|0 1 * * *|/api/cron/usage-aggregate|POST"
  "khabri-webhook-deliver|*/5 * * * *|/api/cron/webhook-deliver|POST"
  "khabri-webhook-cleanup|0 3 * * *|/api/cron/webhook-cleanup|POST"
)

# ── Functions ───────────────────────────────────────────────────────────────

delete_jobs() {
  echo "🗑  Deleting existing Khabri cron jobs..."
  for entry in "${JOBS[@]}"; do
    IFS='|' read -r name _ _ _ <<< "$entry"
    if gcloud scheduler jobs describe "$name" --location="$GCP_LOCATION" --project="$GCP_PROJECT" &>/dev/null; then
      gcloud scheduler jobs delete "$name" \
        --location="$GCP_LOCATION" \
        --project="$GCP_PROJECT" \
        --quiet
      echo "  Deleted: $name"
    else
      echo "  Skipped (not found): $name"
    fi
  done
  echo "Done."
}

create_jobs() {
  echo "Creating Khabri cron jobs in project=$GCP_PROJECT location=$GCP_LOCATION"
  echo "Target: $APP_URL"
  echo ""

  for entry in "${JOBS[@]}"; do
    IFS='|' read -r name schedule path method <<< "$entry"
    url="${APP_URL}${path}"

    # Delete if exists (upsert behavior)
    if gcloud scheduler jobs describe "$name" --location="$GCP_LOCATION" --project="$GCP_PROJECT" &>/dev/null; then
      echo "  Updating: $name ($schedule)"
      gcloud scheduler jobs update http "$name" \
        --location="$GCP_LOCATION" \
        --project="$GCP_PROJECT" \
        --schedule="$schedule" \
        --time-zone="$TIMEZONE" \
        --uri="$url" \
        --http-method="$method" \
        --headers="Authorization=Bearer ${CRON_SECRET}" \
        --attempt-deadline="300s" \
        --quiet
    else
      echo "  Creating: $name ($schedule)"
      gcloud scheduler jobs create http "$name" \
        --location="$GCP_LOCATION" \
        --project="$GCP_PROJECT" \
        --schedule="$schedule" \
        --time-zone="$TIMEZONE" \
        --uri="$url" \
        --http-method="$method" \
        --headers="Authorization=Bearer ${CRON_SECRET}" \
        --attempt-deadline="300s" \
        --quiet
    fi
  done

  echo ""
  echo "All jobs created. Listing:"
  gcloud scheduler jobs list --location="$GCP_LOCATION" --project="$GCP_PROJECT" \
    --filter="name~khabri" --format="table(name, schedule, state, httpTarget.uri)"
}

# ── Main ────────────────────────────────────────────────────────────────────

if [[ "${1:-}" == "--delete" ]]; then
  delete_jobs
else
  create_jobs
fi
