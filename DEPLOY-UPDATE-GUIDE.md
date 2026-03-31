# Khabri — GCP Update & Cron Setup Guide

Since an older version is already deployed on Cloud Run, this guide covers updating the app and setting up Cloud Scheduler cron jobs.

---

## Step 1: Push Changes to GitHub

```bash
git add -A
git commit -m "Post-deployment fixes: user-scoped dashboard, GCP cron support, multi-user trends"
git push origin Main
```

---

## Step 2: Build & Deploy Updated Image to Cloud Run

From your local machine (or Cloud Shell):

```bash
# Set your GCP project
gcloud config set project YOUR_GCP_PROJECT_ID

# Build the image using Cloud Build (builds remotely, no local Docker needed)
gcloud builds submit --tag gcr.io/YOUR_GCP_PROJECT_ID/khabri .

# Deploy to Cloud Run (updates the existing service)
gcloud run deploy khabri \
  --image gcr.io/YOUR_GCP_PROJECT_ID/khabri \
  --region asia-south1 \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --memory 1Gi \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "NEXTAUTH_URL=https://khabri.shownomore.com" \
  --set-env-vars "DATABASE_URL=YOUR_NEON_DATABASE_URL" \
  --set-env-vars "GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID" \
  --set-env-vars "GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET" \
  --set-env-vars "NEXTAUTH_SECRET=YOUR_NEXTAUTH_SECRET" \
  --set-env-vars "GEMINI_API_KEY=YOUR_GEMINI_API_KEY" \
  --set-env-vars "CRON_SECRET=YOUR_CRON_SECRET"
```

**If you already have env vars set on the existing service**, you can skip `--set-env-vars` and just update the image:

```bash
gcloud run deploy khabri \
  --image gcr.io/YOUR_GCP_PROJECT_ID/khabri \
  --region asia-south1 \
  --platform managed
```

**Important:** If you don't have a `Dockerfile` yet, create one first (see Appendix A below).

---

## Step 3: Verify Deployment

```bash
# Check service is running
gcloud run services describe khabri --region asia-south1 --format="value(status.url)"

# Quick health check
curl https://khabri.shownomore.com
```

---

## Step 4: Run Prisma DB Push (if schema changed)

If you've made schema changes since the last deploy, run this against your production DB:

```bash
# Option A: From local machine with production DATABASE_URL
DATABASE_URL="your-production-neon-url" npx prisma db push

# Option B: From Cloud Shell with the same DATABASE_URL
npx prisma db push
```

---

## Step 5: Set Up Cloud Scheduler Cron Jobs

This is the key step that makes cron work on GCP (replacing `vercel.json` crons).

### 5a. Enable Cloud Scheduler API (one-time)

```bash
gcloud services enable cloudscheduler.googleapis.com
```

### 5b. Run the Setup Script

```bash
# Make the script executable
chmod +x scripts/setup-gcp-cron.sh

# Run it with your app URL and cron secret
APP_URL=https://khabri.shownomore.com \
CRON_SECRET="D2H5NkxRxVQoaAOo5fUNUbglm4kwAaWpGVxbPAmIIKg=" \
./scripts/setup-gcp-cron.sh
```

This creates 7 Cloud Scheduler jobs:

| Job | Schedule (IST) | Route |
|-----|----------------|-------|
| khabri-ingest | Every 3 hours (`:00`) | `POST /api/cron/ingest` |
| khabri-enrich | Every 3 hours (`:20`) | `POST /api/cron/enrich` |
| khabri-anomaly | Every 3 hours (`:40`) | `POST /api/cron/anomaly` |
| khabri-trend-monitor | Every 3 hours (`:50`) | `POST /api/cron/trend-monitor` |
| khabri-usage-aggregate | Daily 01:00 | `POST /api/cron/usage-aggregate` |
| khabri-webhook-deliver | Every 5 min | `POST /api/cron/webhook-deliver` |
| khabri-webhook-cleanup | Daily 03:00 | `POST /api/cron/webhook-cleanup` |

### 5c. Verify Jobs Were Created

```bash
gcloud scheduler jobs list --location=asia-south1 --filter="name~khabri"
```

### 5d. Test a Job Manually

```bash
# Force-run the ingest job to test it works
gcloud scheduler jobs run khabri-ingest --location=asia-south1

# Check Cloud Run logs to see if it executed
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=khabri" \
  --limit=20 --format="table(timestamp, textPayload)"
```

Or test directly with curl:

```bash
curl -X POST https://khabri.shownomore.com/api/cron/ingest \
  -H "Authorization: Bearer D2H5NkxRxVQoaAOo5fUNUbglm4kwAaWpGVxbPAmIIKg="
```

You should get a JSON response with `success: true`, `signalsIngested`, and `trendsGenerated`.

---

## Step 6: Verify Everything Works

1. **Login** at `https://khabri.shownomore.com` with Google
2. **Dashboard** should show stats (after first cron run)
3. **Click "Discover Trends"** — should show spinner, then trends appear
4. **Check cron logs** in GCP Console > Cloud Logging

---

## Troubleshooting

### Cron returns 401 Unauthorized
- `CRON_SECRET` in Cloud Run env vars must match the value passed to `setup-gcp-cron.sh`
- Check: `gcloud run services describe khabri --region asia-south1 --format="yaml(spec.template.spec.containers[0].env)"`

### Cron returns 500
- Check Cloud Run logs: GCP Console > Cloud Run > khabri > Logs
- Common cause: `DATABASE_URL` not set or Neon DB unreachable

### Cloud Scheduler shows "FAILED"
- Click the job in GCP Console > Cloud Scheduler to see error details
- Ensure Cloud Run service allows unauthenticated requests (since auth is via Bearer token in headers, not IAM)

### No trends appearing after cron run
- Run ingest manually and check the response: it should show `signalsIngested > 0` and `trendsGenerated > 0`
- If `signalsIngested: 0` — all signals already exist (deduped). Try after 3 hours when new RSS items appear

### To delete all cron jobs and recreate
```bash
APP_URL=https://khabri.shownomore.com CRON_SECRET="your-secret" ./scripts/setup-gcp-cron.sh --delete
APP_URL=https://khabri.shownomore.com CRON_SECRET="your-secret" ./scripts/setup-gcp-cron.sh
```

---

## Appendix A: Dockerfile (if missing)

If you don't have a Dockerfile yet, create one:

```dockerfile
# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# Stage 3: Production runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000
CMD ["node", "server.js"]
```

**Note:** This requires `output: "standalone"` in your `next.config.ts`:

```typescript
const nextConfig = {
  output: "standalone",
};
export default nextConfig;
```
