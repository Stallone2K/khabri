import { prisma } from "@/lib/prisma";
import { generateJSON } from "@/lib/gemini";

// =============================================================================
// TYPES
// =============================================================================

export interface NarrativeAngle {
  title: string;
  summary: string;
  keywords: string[];
}

// =============================================================================
// PROMPT
// =============================================================================

function buildDiscoveryPrompt(
  topic: string,
  signalHeadlines: string[],
): string {
  const signalSection =
    signalHeadlines.length > 0
      ? `\nRECENT SIGNALS (${signalHeadlines.length} headlines from the last 24 hours):\n${signalHeadlines.map((h, i) => `${i + 1}. ${h}`).join("\n")}`
      : "\nNo recent signals available — use your knowledge to identify likely narrative angles.";

  return `You are NARRATIVE_ENGINE — an intelligence analyst that discovers distinct narrative threads within a breaking story or trend.

TOPIC: "${topic}"
${signalSection}

TASK:
Analyze the topic and identify 3-5 DISTINCT narrative angles (sub-stories) that are developing within this larger trend. Each narrative should be a separate thread that an analyst would want to track independently.

RULES:
- Each narrative must be COMPLETELY DISTINCT — no two narratives should cover the same angle, region, or theme. If two narratives share more than 1 keyword, they are too similar.
- Focus on narratives that are ACTIVE and evolving, not historical background.
- Keywords must be UNIQUE per narrative — do not reuse keywords across narratives.
- Keywords should be specific tracking terms (lowercase, no generic words like "news", "report", "concerns").
- Summaries should be 1-2 sentences explaining what this narrative thread is about.
- If the topic is very niche with limited angles, return fewer narratives (minimum 2).

OUTPUT FORMAT (strict JSON array, no wrapping text):
[
  {
    "title": "Concise Narrative Title (max 8 words)",
    "summary": "1-2 sentence description of this narrative angle and why it matters.",
    "keywords": ["keyword1", "keyword2", "keyword3"]
  }
]`;
}

// =============================================================================
// DISCOVERY FUNCTION
// =============================================================================

/**
 * Discover narrative angles for a tracked trend.
 * Queries recent signals matching the topic, then uses AI to identify sub-narratives.
 */
export async function discoverNarratives(
  projectTitle: string,
): Promise<NarrativeAngle[]> {
  // 1. Extract keywords from the project title
  const titleWords = projectTitle
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);

  // 2. Query recent signals matching any of these keywords (last 24h)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let signalHeadlines: string[] = [];

  if (titleWords.length > 0) {
    const signals = await prisma.$queryRaw<{ title: string }[]>`
      SELECT DISTINCT s."title"
      FROM "SignalKeyword" sk
      JOIN "Signal" s ON sk."signalId" = s."id"
      WHERE sk."keyword" = ANY(${titleWords})
        AND s."createdAt" >= ${since}
      LIMIT 30
    `;
    signalHeadlines = signals.map((s) => s.title);
  }

  // 3. Ask AI to discover narratives
  const prompt = buildDiscoveryPrompt(projectTitle, signalHeadlines);
  const narratives = await generateJSON<NarrativeAngle[]>(
    "gemini-flash-latest",
    prompt,
    0.4,
  );

  // 4. Validate, clean, and deduplicate
  const cleaned = narratives
    .filter((n) => n.title && n.keywords?.length > 0)
    .map((n) => ({
      title: n.title.trim(),
      summary: n.summary?.trim() || "",
      keywords: n.keywords.map((k) => k.toLowerCase().trim()).filter(Boolean),
    }));

  // Deduplicate by keyword overlap (>50% shared keywords = duplicate)
  const unique: NarrativeAngle[] = [];
  for (const narrative of cleaned) {
    const isDuplicate = unique.some((existing) => {
      const existingSet = new Set(existing.keywords);
      const overlap = narrative.keywords.filter((k) => existingSet.has(k)).length;
      const minLen = Math.min(existing.keywords.length, narrative.keywords.length);
      return minLen > 0 && overlap / minLen > 0.5;
    });
    if (!isDuplicate) unique.push(narrative);
  }

  return unique.slice(0, 5);
}
