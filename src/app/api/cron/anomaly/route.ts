import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/api-auth";
import { emitEvent } from "@/lib/webhook-events";
import {
  countKeywordsSince,
  countEntitiesSince,
  countCountriesSince,
  computeAnomaly,
  welfordUpdate,
  computeAutoResolveTime,
  keyToLabel,
  dimensionToType,
  type WelfordState,
} from "@/lib/algorithms/anomaly-detection";
export async function POST(req: Request) {
  // =========================================================================
  // 1. AUTH
  // =========================================================================
  const isCron = verifyCronSecret(req);
  const isDev = process.env.NODE_ENV === "development";
  if (!isCron && !isDev) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    console.log("[ANOMALY] Starting anomaly detection...");

    // =========================================================================
    // 2. AGGREGATE — run all 4 queries in parallel
    // =========================================================================
    const [keywordCounts, entityCounts, countryCounts] =
      await Promise.all([
        countKeywordsSince(prisma, oneHourAgo),
        countEntitiesSince(prisma, oneHourAgo),
        countCountriesSince(prisma, oneHourAgo),
      ]);

    console.log(
      `[ANOMALY] Aggregated: ${keywordCounts.size} keywords, ${entityCounts.size} entities, ` +
        `${countryCounts.size} countries`,
    );

    // =========================================================================
    // 3. COLLECT all dimension/key pairs
    // =========================================================================
    const allMetrics: { dimension: string; key: string; value: number }[] = [];

    for (const [key, value] of keywordCounts) {
      allMetrics.push({ dimension: "KEYWORD", key, value });
    }
    for (const [key, value] of entityCounts) {
      allMetrics.push({ dimension: "ENTITY", key, value });
    }
    for (const [key, value] of countryCounts) {
      allMetrics.push({ dimension: "COUNTRY", key, value });
    }

    if (allMetrics.length === 0) {
      console.log("[ANOMALY] No metrics to process. Exiting.");
      return NextResponse.json({ success: true, processed: 0, anomaliesCreated: 0 });
    }

    // =========================================================================
    // 4. BULK-FETCH existing baselines
    // =========================================================================
    const baselineRecords = await prisma.anomalyBaseline.findMany({
      where: {
        OR: allMetrics.map((m) => ({ dimension: m.dimension, key: m.key })),
      },
    });

    const baselineMap = new Map<string, (typeof baselineRecords)[0]>();
    for (const b of baselineRecords) {
      baselineMap.set(`${b.dimension}::${b.key}`, b);
    }

    // =========================================================================
    // 5. FETCH existing active anomalies for dedup
    // =========================================================================
    const activeAnomalies = await prisma.anomalyEvent.findMany({
      where: { isResolved: false },
      select: { id: true, key: true, type: true, severity: true, zScore: true },
    });

    const activeAnomalyMap = new Map<string, (typeof activeAnomalies)[0]>();
    for (const a of activeAnomalies) {
      activeAnomalyMap.set(a.key, a);
    }

    // =========================================================================
    // 6. PROCESS each metric
    // =========================================================================
    const SEVERITY_RANK: Record<string, number> = {
      NONE: 0, ELEVATED: 1, HIGH: 2, CRITICAL: 3,
    };

    const baselineUpserts: {
      dimension: string;
      key: string;
      state: WelfordState;
      lastValue: number;
    }[] = [];

    const newAnomalies: {
      type: string;
      key: string;
      label: string;
      zScore: number;
      currentValue: number;
      baselineMean: number;
      baselineStdDev: number;
      severity: string;
      autoResolvesAt: Date;
    }[] = [];

    const anomalyUpdates: {
      id: string;
      zScore: number;
      currentValue: number;
      baselineMean: number;
      baselineStdDev: number;
      severity: string;
      autoResolvesAt: Date;
    }[] = [];

    for (const metric of allMetrics) {
      const lookupKey = `${metric.dimension}::${metric.key}`;
      const existing = baselineMap.get(lookupKey);

      const state: WelfordState = existing
        ? { mean: existing.mean, m2: existing.m2, sampleCount: existing.sampleCount }
        : { mean: 0, m2: 0, sampleCount: 0 };

      // Compute anomaly BEFORE updating state (compare against prior baseline)
      const result = computeAnomaly(state, metric.value);

      // Update Welford state with this observation
      const newState = welfordUpdate(state, metric.value);
      baselineUpserts.push({
        dimension: metric.dimension,
        key: metric.key,
        state: newState,
        lastValue: metric.value,
      });

      // Check if we need to create/update an anomaly event
      if (result.severity !== "NONE") {
        const existingAnomaly = activeAnomalyMap.get(metric.key);

        if (existingAnomaly) {
          // Update if new severity >= existing
          if (
            SEVERITY_RANK[result.severity] >=
            SEVERITY_RANK[existingAnomaly.severity]
          ) {
            anomalyUpdates.push({
              id: existingAnomaly.id,
              zScore: result.zScore,
              currentValue: result.currentValue,
              baselineMean: result.baselineMean,
              baselineStdDev: result.baselineStdDev,
              severity: result.severity,
              autoResolvesAt: computeAutoResolveTime(result.severity, now),
            });
          }
        } else {
          // Create new anomaly
          newAnomalies.push({
            type: dimensionToType(metric.dimension),
            key: metric.key,
            label: keyToLabel(metric.dimension, metric.key),
            zScore: result.zScore,
            currentValue: result.currentValue,
            baselineMean: result.baselineMean,
            baselineStdDev: result.baselineStdDev,
            severity: result.severity,
            autoResolvesAt: computeAutoResolveTime(result.severity, now),
          });
        }
      }
    }

    // =========================================================================
    // 7. WRITE — baselines, new anomalies, updates, auto-resolve
    // =========================================================================
    await prisma.$transaction(async (tx) => {
      // Upsert baselines (batch in chunks of 50 to avoid hitting limits)
      for (let i = 0; i < baselineUpserts.length; i += 50) {
        const batch = baselineUpserts.slice(i, i + 50);
        await Promise.all(
          batch.map((b) =>
            tx.anomalyBaseline.upsert({
              where: {
                dimension_key: { dimension: b.dimension, key: b.key },
              },
              create: {
                dimension: b.dimension,
                key: b.key,
                mean: b.state.mean,
                m2: b.state.m2,
                sampleCount: b.state.sampleCount,
                lastValue: b.lastValue,
                lastUpdatedAt: now,
              },
              update: {
                mean: b.state.mean,
                m2: b.state.m2,
                sampleCount: b.state.sampleCount,
                lastValue: b.lastValue,
                lastUpdatedAt: now,
              },
            }),
          ),
        );
      }

      // Create new anomaly events
      if (newAnomalies.length > 0) {
        await tx.anomalyEvent.createMany({ data: newAnomalies });
      }

      // Update existing anomaly events
      for (const update of anomalyUpdates) {
        await tx.anomalyEvent.update({
          where: { id: update.id },
          data: {
            zScore: update.zScore,
            currentValue: update.currentValue,
            baselineMean: update.baselineMean,
            baselineStdDev: update.baselineStdDev,
            severity: update.severity,
            autoResolvesAt: update.autoResolvesAt,
          },
        });
      }

      // Auto-resolve expired anomalies
      await tx.anomalyEvent.updateMany({
        where: {
          isResolved: false,
          autoResolvesAt: { lte: now },
        },
        data: {
          isResolved: true,
          resolvedAt: now,
        },
      });
    });

    // Emit webhook events for new anomalies (outside transaction)
    for (const anomaly of newAnomalies) {
      emitEvent("anomaly.detected", {
        type: anomaly.type,
        key: anomaly.key,
        label: anomaly.label,
        severity: anomaly.severity,
        zScore: anomaly.zScore,
        currentValue: anomaly.currentValue,
        baselineMean: anomaly.baselineMean,
      }, null); // Global — no user scoping
    }

    const stats = {
      processed: allMetrics.length,
      baselinesUpserted: baselineUpserts.length,
      anomaliesCreated: newAnomalies.length,
      anomaliesUpdated: anomalyUpdates.length,
    };

    console.log(
      `[ANOMALY] Done: ${stats.processed} metrics processed, ` +
        `${stats.baselinesUpserted} baselines updated, ` +
        `${stats.anomaliesCreated} new anomalies, ${stats.anomaliesUpdated} updated`,
    );

    return NextResponse.json({ success: true, ...stats });
  } catch (error: any) {
    console.error("[ANOMALY] Fatal error:", error);
    return NextResponse.json(
      { error: "Anomaly detection failed", details: error.message || String(error) },
      { status: 500 },
    );
  }
}
