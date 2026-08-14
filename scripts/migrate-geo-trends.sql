-- geo-trends feature migration — SAFE for the drifted prod database.
-- Purely additive: no drops, no data changes. Do NOT use `prisma db push`
-- against prod (it would drop legacy tables absent from the schema).
--
-- Apply: sudo -u postgres psql -d khabri -f migrate-geo-trends.sql
-- Then:  yarn seed:geonames && npx tsx scripts/backfill-geo.ts

ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "geonameId"  INTEGER;
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "asciiName"  TEXT;
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "admin1Code" TEXT;
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "admin2Code" TEXT;
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "population" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "Location_geonameId_key" ON "Location" ("geonameId");
CREATE INDEX IF NOT EXISTS "Location_countryCode_admin1Code_idx" ON "Location" ("countryCode", "admin1Code");
CREATE INDEX IF NOT EXISTS "Location_name_idx" ON "Location" ("name");

-- Resolver hot paths (Prisma cannot express these)
CREATE INDEX IF NOT EXISTS location_name_lower_idx ON "Location" (LOWER(name));
CREATE INDEX IF NOT EXISTS location_asciiname_lower_idx ON "Location" (LOWER("asciiName"));
CREATE INDEX IF NOT EXISTS location_aliases_gin_idx ON "Location" USING GIN (aliases);

CREATE TABLE IF NOT EXISTS "RegionTrendCache" (
  "id"         TEXT NOT NULL,
  "regionKey"  TEXT NOT NULL,
  "window"     TEXT NOT NULL,
  "trends"     JSONB NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegionTrendCache_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RegionTrendCache_regionKey_window_key"
  ON "RegionTrendCache" ("regionKey", "window");
CREATE INDEX IF NOT EXISTS "RegionTrendCache_computedAt_idx"
  ON "RegionTrendCache" ("computedAt");
