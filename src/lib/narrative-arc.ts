import { prisma } from "@/lib/prisma";
import { generateText } from "@/lib/gemini";
import { buildArcPhasePrompt } from "@/lib/prompts";

const MODEL = "gemini-flash-latest";

export interface ArcDataPoint {
  date: string;
  eventCount: number;
  avgSentiment: number;
  peakImpact: number;
}

export interface ArcResult {
  nodeId: string;
  phase: string | null;
  dataPoints: ArcDataPoint[];
}

/**
 * Compute narrative arc data by aggregating events per day.
 * Returns daily data points and optionally detects the arc phase via AI.
 */
export async function computeNarrativeArc(nodeId: string): Promise<ArcResult> {
  const events = await prisma.narrativeEvent.findMany({
    where: { nodeId },
    orderBy: { createdAt: "asc" },
    select: {
      createdAt: true,
      impactScore: true,
      sentiment: true,
    },
  });

  if (events.length === 0) {
    return { nodeId, phase: null, dataPoints: [] };
  }

  // Group events by date
  const dayMap = new Map<string, { count: number; sentimentSum: number; sentimentCount: number; peakImpact: number }>();

  for (const event of events) {
    const date = event.createdAt.toISOString().split("T")[0];
    const existing = dayMap.get(date) || { count: 0, sentimentSum: 0, sentimentCount: 0, peakImpact: 0 };

    existing.count++;
    existing.peakImpact = Math.max(existing.peakImpact, event.impactScore);

    // Convert sentiment string to number
    if (event.sentiment) {
      const sentimentVal = event.sentiment === "POSITIVE" ? 0.5 : event.sentiment === "NEGATIVE" ? -0.5 : 0;
      existing.sentimentSum += sentimentVal;
      existing.sentimentCount++;
    }

    dayMap.set(date, existing);
  }

  const dataPoints: ArcDataPoint[] = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      eventCount: data.count,
      avgSentiment: data.sentimentCount > 0 ? data.sentimentSum / data.sentimentCount : 0,
      peakImpact: data.peakImpact,
    }));

  // Get current phase from DB (return without AI call if < 3 days of data)
  const node = await prisma.narrativeNode.findUnique({
    where: { id: nodeId },
    select: { arcPhase: true },
  });

  return {
    nodeId,
    phase: node?.arcPhase || null,
    dataPoints,
  };
}

/**
 * Compute and persist the arc phase for a node using AI.
 * Only runs if the node has 3+ days of event data.
 */
export async function computeArcPhase(nodeId: string, nodeTitle: string): Promise<string | null> {
  const arc = await computeNarrativeArc(nodeId);

  if (arc.dataPoints.length < 3) return arc.phase;

  const prompt = buildArcPhasePrompt(nodeTitle, arc.dataPoints);
  const raw = await generateText(MODEL, prompt, 0.1);
  const phase = raw.trim().toUpperCase();

  const validPhases = ["EMERGENCE", "ESCALATION", "PEAK", "RESOLUTION"];
  if (!validPhases.includes(phase)) return arc.phase;

  // Persist
  await prisma.narrativeNode.update({
    where: { id: nodeId },
    data: { arcPhase: phase },
  });

  return phase;
}
