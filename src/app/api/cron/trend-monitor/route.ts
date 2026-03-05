import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/api-auth";
import { analyzeSignalSignificance } from "@/lib/narrative-analysis";
import { extractStakeholders } from "@/lib/narrative-stakeholders";
import { discoverSubNarratives } from "@/lib/narrative-split";
import { computeArcPhase } from "@/lib/narrative-arc";

export async function POST(req: Request) {
  const isCron = verifyCronSecret(req);
  const isDev = process.env.NODE_ENV === "development";
  if (!isCron && !isDev) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[TREND-MONITOR] Starting trend monitor...");

    // 1. Get all active tracked trends with their narrative nodes
    const projects = await prisma.project.findMany({
      where: { type: "TRACKED_TREND", status: "TRACKING" },
      include: {
        narrativeNodes: {
          where: { status: "ACTIVE" },
          select: { id: true, title: true, summary: true, keywords: true, lastSignalAt: true, signalCount: true, parentId: true },
        },
      },
    });

    if (projects.length === 0) {
      console.log("[TREND-MONITOR] No active tracked trends. Exiting.");
      return NextResponse.json({ success: true, processed: 0 });
    }

    console.log(`[TREND-MONITOR] Monitoring ${projects.length} tracked trends`);

    let totalEventsCreated = 0;
    let totalNodesUpdated = 0;

    for (const project of projects) {
      if (project.narrativeNodes.length === 0) continue;

      // 2. Collect all keywords from narrative nodes
      const allKeywords = new Set<string>();
      for (const node of project.narrativeNodes) {
        for (const kw of node.keywords) {
          allKeywords.add(kw);
        }
      }

      if (allKeywords.size === 0) continue;

      // 3. Find the most recent signal check time (oldest lastSignalAt or 24h ago for first run)
      const since = project.narrativeNodes.reduce((earliest, node) => {
        if (!node.lastSignalAt) return earliest;
        return node.lastSignalAt < earliest ? node.lastSignalAt : earliest;
      }, new Date(Date.now() - 24 * 60 * 60 * 1000));

      // 4. Query new signals matching any tracked keywords
      const keywordArray = Array.from(allKeywords);
      const signals = await prisma.$queryRaw<
        { id: string; title: string; url: string; keyword: string }[]
      >`
        SELECT DISTINCT s."id", s."title", s."url", sk."keyword"
        FROM "SignalKeyword" sk
        JOIN "Signal" s ON sk."signalId" = s."id"
        WHERE sk."keyword" = ANY(${keywordArray})
          AND s."createdAt" >= ${since}
        ORDER BY s."id" DESC
        LIMIT 50
      `;

      if (signals.length === 0) continue;

      // 5. Match signals to the best narrative node (most keyword overlap)
      const signalsByNode = new Map<string, typeof signals>();

      for (const signal of signals) {
        let bestNodeId: string | null = null;
        let bestScore = 0;

        for (const node of project.narrativeNodes) {
          const matchCount = node.keywords.filter(
            (kw) => kw === signal.keyword,
          ).length;
          if (matchCount > bestScore) {
            bestScore = matchCount;
            bestNodeId = node.id;
          }
        }

        if (bestNodeId) {
          const existing = signalsByNode.get(bestNodeId) || [];
          // Deduplicate by signal ID
          if (!existing.some((s) => s.id === signal.id)) {
            existing.push(signal);
            signalsByNode.set(bestNodeId, existing);
          }
        }
      }

      // 6. Create AI-enriched events and update nodes
      const now = new Date();

      for (const [nodeId, nodeSignals] of signalsByNode) {
        // Check for existing events to avoid duplicates
        const existingUrls = await prisma.narrativeEvent.findMany({
          where: {
            nodeId,
            sourceUrl: { in: nodeSignals.map((s) => s.url) },
          },
          select: { sourceUrl: true },
        });
        const existingUrlSet = new Set(existingUrls.map((e) => e.sourceUrl));

        const newSignals = nodeSignals.filter(
          (s) => !existingUrlSet.has(s.url),
        );

        if (newSignals.length === 0) continue;

        // Find the node metadata for AI analysis
        const node = project.narrativeNodes.find((n) => n.id === nodeId);
        if (!node) continue;

        // Phase 2: AI Significance Analysis
        let enrichedData: { id: string; relevant: boolean; impactScore: number; sentiment: number; summary: string }[] = [];
        try {
          enrichedData = await analyzeSignalSignificance(
            node.title,
            node.summary,
            node.keywords,
            newSignals.map((s) => ({ id: s.id, title: s.title, url: s.url })),
          );
          console.log(`[TREND-MONITOR] AI analysis: ${enrichedData.filter((e) => e.relevant).length}/${newSignals.length} relevant for "${node.title}"`);
        } catch (err) {
          console.warn(`[TREND-MONITOR] AI analysis failed for node ${nodeId}, falling back to basic creation:`, err);
        }

        // Build enrichment lookup
        const enrichmentMap = new Map(enrichedData.map((e) => [e.id, e]));

        // Filter to relevant signals only (or all if AI failed)
        const signalsToCreate = enrichedData.length > 0
          ? newSignals.filter((s) => {
              const enrichment = enrichmentMap.get(s.id);
              return enrichment ? enrichment.relevant : true; // keep if AI didn't evaluate
            })
          : newSignals;

        if (signalsToCreate.length === 0) continue;

        // Create enriched events
        await prisma.narrativeEvent.createMany({
          data: signalsToCreate.map((s) => {
            const enrichment = enrichmentMap.get(s.id);
            return {
              nodeId,
              title: s.title,
              sourceUrl: s.url,
              summary: enrichment?.summary || null,
              impactScore: enrichment?.impactScore ?? 0,
              sentiment: enrichment?.sentiment != null ? String(enrichment.sentiment > 0 ? "POSITIVE" : enrichment.sentiment < 0 ? "NEGATIVE" : "NEUTRAL") : null,
            };
          }),
        });

        // Update signal count and last signal time
        await prisma.narrativeNode.update({
          where: { id: nodeId },
          data: {
            signalCount: { increment: signalsToCreate.length },
            lastSignalAt: now,
          },
        });

        // Phase 3: Stakeholder Extraction
        try {
          const urls = signalsToCreate.map((s) => s.url);
          const stakeholderCount = await extractStakeholders(nodeId, urls);
          if (stakeholderCount > 0) {
            console.log(`[TREND-MONITOR] Extracted ${stakeholderCount} stakeholders for node "${node.title}"`);
          }
        } catch (err) {
          console.warn(`[TREND-MONITOR] Stakeholder extraction failed for node ${nodeId}:`, err);
        }

        totalEventsCreated += signalsToCreate.length;
        totalNodesUpdated++;
      }

      // Phase 4: Auto Sub-Narrative Discovery
      // Check nodes with 5+ events and no children for potential splitting
      for (const node of project.narrativeNodes) {
        if (node.signalCount < 5) continue;
        try {
          const created = await discoverSubNarratives(node.id, node.title, project.id);
          if (created > 0) {
            console.log(`[TREND-MONITOR] Auto-discovered ${created} sub-narratives for "${node.title}"`);
          }
        } catch (err) {
          console.warn(`[TREND-MONITOR] Sub-narrative discovery failed for node ${node.id}:`, err);
        }
      }

      // Phase 5: Arc Phase Update
      // Recompute arc phase for nodes that received new events
      for (const [nodeId] of signalsByNode) {
        const node = project.narrativeNodes.find((n) => n.id === nodeId);
        if (!node) continue;
        try {
          await computeArcPhase(nodeId, node.title);
        } catch (err) {
          console.warn(`[TREND-MONITOR] Arc phase update failed for node ${nodeId}:`, err);
        }
      }
    }

    console.log(
      `[TREND-MONITOR] Done: ${totalEventsCreated} events created, ${totalNodesUpdated} nodes updated`,
    );

    return NextResponse.json({
      success: true,
      projectsMonitored: projects.length,
      eventsCreated: totalEventsCreated,
      nodesUpdated: totalNodesUpdated,
    });
  } catch (error: any) {
    console.error("[TREND-MONITOR] Error:", error);
    return NextResponse.json(
      { error: "Trend monitor failed", details: error.message },
      { status: 500 },
    );
  }
}
