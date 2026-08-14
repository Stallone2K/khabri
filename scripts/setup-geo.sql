-- Khabri v08.2026 geo setup — run once per database (dev now, VPS at go-live).
-- Prisma cannot express these: extension, expression GIST indexes, LOWER() index.

CREATE EXTENSION IF NOT EXISTS postgis;

-- Radius queries: ST_DWithin over signal locations without a stored geography column.
CREATE INDEX IF NOT EXISTS signal_location_geog_idx
  ON "SignalLocation"
  USING GIST ((ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography))
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Gazetteer point index (nearest-place lookups, reverse geocoding).
CREATE INDEX IF NOT EXISTS location_geog_idx
  ON "Location"
  USING GIST ((ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography))
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Case-insensitive gazetteer name matching (resolver hot path).
CREATE INDEX IF NOT EXISTS location_name_lower_idx ON "Location" (LOWER(name));
CREATE INDEX IF NOT EXISTS location_asciiname_lower_idx ON "Location" (LOWER("asciiName"));

-- Alias overlap matching (resolver pass 2).
CREATE INDEX IF NOT EXISTS location_aliases_gin_idx ON "Location" USING GIN (aliases);
