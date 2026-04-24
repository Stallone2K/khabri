import { GoogleGenAI } from "@google/genai";

// Shared Gemini client instance
export const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Retry config for 429 / transient 5xx errors
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 1500;

function isRetriableError(err: unknown): boolean {
  const e = err as { status?: number; message?: string };
  if (e?.status === 429) return true;
  if (e?.status && e.status >= 500 && e.status < 600) return true;
  if (typeof e?.message === "string" && /RESOURCE_EXHAUSTED|UNAVAILABLE|DEADLINE_EXCEEDED/i.test(e.message)) {
    return true;
  }
  return false;
}

async function callWithBackoff<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetriableError(err) || attempt === MAX_RETRIES) throw err;
      const delay = BASE_DELAY_MS * 2 ** attempt + Math.floor(Math.random() * 500);
      console.warn(`[GEMINI] Retriable error (attempt ${attempt + 1}/${MAX_RETRIES}), waiting ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/**
 * Generate structured JSON from a prompt using Gemini.
 * Automatically strips markdown fences and parses JSON.
 */
export async function generateJSON<T = unknown>(
  model: string,
  prompt: string,
  temperature = 0.2
): Promise<T> {
  const response = await callWithBackoff(() =>
    gemini.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", temperature },
    })
  );

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

/**
 * Generate plain text from a prompt using Gemini.
 */
export async function generateText(
  model: string,
  prompt: string,
  temperature = 0.3
): Promise<string> {
  const response = await callWithBackoff(() =>
    gemini.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature },
    })
  );

  return response.candidates?.[0]?.content?.parts?.[0]?.text || "";
}
