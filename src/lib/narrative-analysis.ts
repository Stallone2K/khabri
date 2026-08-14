import { generateJSON } from "@/lib/gemini";
import { buildSignalSignificancePrompt } from "@/lib/prompts";

const MODEL = "gemini-3.5-flash";

interface SignalInput {
  id: string;
  title: string;
  url: string;
}

interface SignificanceResult {
  id: string;
  relevant: boolean;
  impactScore: number;
  sentiment: number;
  summary: string;
}

/**
 * Analyze signals for relevance and significance to a narrative node.
 * Filters out keyword-coincidence noise and enriches with impact/sentiment/summary.
 */
export async function analyzeSignalSignificance(
  narrativeTitle: string,
  narrativeSummary: string | null,
  keywords: string[],
  signals: SignalInput[],
): Promise<SignificanceResult[]> {
  if (signals.length === 0) return [];

  const prompt = buildSignalSignificancePrompt(
    narrativeTitle,
    narrativeSummary,
    keywords,
    signals,
  );

  const results = await generateJSON<SignificanceResult[]>(MODEL, prompt, 0.1);

  // Validate and normalize results
  return results
    .filter((r) => r && typeof r.id === "string")
    .map((r) => ({
      id: r.id,
      relevant: Boolean(r.relevant),
      impactScore: Math.max(0, Math.min(100, Number(r.impactScore) || 0)),
      sentiment: Math.max(-1, Math.min(1, Number(r.sentiment) || 0)),
      summary: r.relevant ? (r.summary || "").trim() : "",
    }));
}
