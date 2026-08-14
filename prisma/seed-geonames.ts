/**
 * GeoNames gazetteer import — Khabri v08.2026 Phase 0.
 *
 * Imports the world place hierarchy into Location:
 *   COUNTRY  (countryInfo.txt, ~250)
 *   STATE    (admin1CodesASCII.txt, ~3.9k)     — admin1
 *   DISTRICT (admin2Codes.txt, ~45k)           — admin2
 *   CITY     (cities500.zip, ~230k, pop >= 500)
 *
 * Idempotent: rows keyed on unique geonameId, re-runs skip existing.
 * Admin rows get centroid lat/lng computed from their member cities.
 *
 * Run: npx tsx prisma/seed-geonames.ts
 */
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const prisma = new PrismaClient();

const DUMP_BASE = "https://download.geonames.org/export/dump";
const CACHE_DIR = path.join(os.tmpdir(), "khabri-geonames");
const BATCH = 1000;
const MAX_ALIASES = 12;

async function download(file: string): Promise<string> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const dest = path.join(CACHE_DIR, file);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    console.log(`[GEONAMES] cached: ${file}`);
    return dest;
  }
  console.log(`[GEONAMES] downloading ${file}...`);
  const res = await fetch(`${DUMP_BASE}/${file}`);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

function readLines(filePath: string): string[] {
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"));
}

async function insertBatched(rows: any[], label: string) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const res = await prisma.location.createMany({
      data: rows.slice(i, i + BATCH),
      skipDuplicates: true,
    });
    inserted += res.count;
  }
  console.log(`[GEONAMES] ${label}: ${inserted} inserted (${rows.length - inserted} already present)`);
}

async function main() {
  const t0 = Date.now();

  // ---------------------------------------------------------------- countries
  const countryLines = readLines(await download("countryInfo.txt"));
  const countries = countryLines
    .map((l) => l.split("\t"))
    .filter((c) => c[16]) // has geonameId
    .map((c) => ({
      geonameId: parseInt(c[16], 10),
      name: c[4],
      asciiName: c[4],
      type: "COUNTRY",
      countryCode: c[0],
      population: parseInt(c[7] || "0", 10) || 0,
      aliases: [] as string[],
    }));
  await insertBatched(countries, "countries");

  const countryIdByCode = new Map<string, string>();
  for (const row of await prisma.location.findMany({
    where: { type: "COUNTRY", geonameId: { not: null } },
    select: { id: true, countryCode: true },
  })) {
    if (row.countryCode) countryIdByCode.set(row.countryCode, row.id);
  }

  // ------------------------------------------------------------------ admin1
  const admin1Lines = readLines(await download("admin1CodesASCII.txt"));
  const admin1 = admin1Lines
    .map((l) => l.split("\t"))
    .filter((a) => a[3])
    .map((a) => {
      const [countryCode, admin1Code] = a[0].split(".");
      return {
        geonameId: parseInt(a[3], 10),
        name: a[1],
        asciiName: a[2],
        type: "STATE",
        countryCode,
        admin1Code,
        parentId: countryIdByCode.get(countryCode) ?? null,
        aliases: [] as string[],
      };
    });
  await insertBatched(admin1, "admin1 (states)");

  const admin1IdByKey = new Map<string, string>();
  for (const row of await prisma.location.findMany({
    where: { type: "STATE" },
    select: { id: true, countryCode: true, admin1Code: true },
  })) {
    admin1IdByKey.set(`${row.countryCode}.${row.admin1Code}`, row.id);
  }

  // ------------------------------------------------------------------ admin2
  const admin2Lines = readLines(await download("admin2Codes.txt"));
  const admin2 = admin2Lines
    .map((l) => l.split("\t"))
    .filter((a) => a[3])
    .map((a) => {
      const [countryCode, admin1Code, admin2Code] = a[0].split(".");
      return {
        geonameId: parseInt(a[3], 10),
        name: a[1],
        asciiName: a[2],
        type: "DISTRICT",
        countryCode,
        admin1Code,
        admin2Code,
        parentId:
          admin1IdByKey.get(`${countryCode}.${admin1Code}`) ??
          countryIdByCode.get(countryCode) ??
          null,
        aliases: [] as string[],
      };
    });
  await insertBatched(admin2, "admin2 (districts)");

  const admin2IdByKey = new Map<string, string>();
  for (const row of await prisma.location.findMany({
    where: { type: "DISTRICT" },
    select: { id: true, countryCode: true, admin1Code: true, admin2Code: true },
  })) {
    admin2IdByKey.set(`${row.countryCode}.${row.admin1Code}.${row.admin2Code}`, row.id);
  }

  // ------------------------------------------------------------------ cities
  const zipPath = await download("cities500.zip");
  const txtPath = path.join(CACHE_DIR, "cities500.txt");
  if (!fs.existsSync(txtPath)) {
    execFileSync("unzip", ["-o", zipPath, "-d", CACHE_DIR], { stdio: "ignore" });
  }
  const cityLines = readLines(txtPath);
  console.log(`[GEONAMES] parsing ${cityLines.length} cities...`);
  const cities = cityLines.map((l) => {
    const c = l.split("\t");
    const countryCode = c[8];
    const admin1Code = c[10] || null;
    const admin2Code = c[11] || null;
    const parentId =
      (admin2Code && admin2IdByKey.get(`${countryCode}.${admin1Code}.${admin2Code}`)) ||
      (admin1Code && admin1IdByKey.get(`${countryCode}.${admin1Code}`)) ||
      countryIdByCode.get(countryCode) ||
      null;
    return {
      geonameId: parseInt(c[0], 10),
      name: c[1],
      asciiName: c[2],
      type: "CITY",
      countryCode,
      admin1Code,
      admin2Code,
      lat: parseFloat(c[4]),
      lng: parseFloat(c[5]),
      population: parseInt(c[14] || "0", 10) || 0,
      parentId,
      aliases: c[3] ? c[3].split(",").filter(Boolean).slice(0, MAX_ALIASES) : [],
    };
  });
  await insertBatched(cities, "cities (pop >= 500)");

  // ------------------------------------- centroids for admin rows (from cities)
  console.log("[GEONAMES] computing admin centroids from member cities...");
  await prisma.$executeRawUnsafe(`
    UPDATE "Location" p SET lat = c.avg_lat, lng = c.avg_lng
    FROM (
      SELECT "parentId", AVG(lat) AS avg_lat, AVG(lng) AS avg_lng
      FROM "Location"
      WHERE type = 'CITY' AND "parentId" IS NOT NULL AND lat IS NOT NULL
      GROUP BY "parentId"
    ) c
    WHERE p.id = c."parentId" AND p.lat IS NULL
  `);
  // countries: centroid of their states/districts/cities
  await prisma.$executeRawUnsafe(`
    UPDATE "Location" p SET lat = c.avg_lat, lng = c.avg_lng
    FROM (
      SELECT "countryCode", AVG(lat) AS avg_lat, AVG(lng) AS avg_lng
      FROM "Location"
      WHERE type = 'CITY' AND lat IS NOT NULL
      GROUP BY "countryCode"
    ) c
    WHERE p."countryCode" = c."countryCode" AND p.type = 'COUNTRY' AND p.lat IS NULL
  `);

  const counts = await prisma.location.groupBy({ by: ["type"], _count: true });
  console.log(`[GEONAMES] done in ${Math.round((Date.now() - t0) / 1000)}s:`, counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
