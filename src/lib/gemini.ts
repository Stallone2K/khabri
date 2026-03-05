import { GoogleGenAI } from "@google/genai";

// Shared Gemini client instance
export const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/**
 * Generate structured JSON from a prompt using Gemini.
 * Automatically strips markdown fences and parses JSON.
 */
export async function generateJSON<T = unknown>(
  model: string,
  prompt: string,
  temperature = 0.2
): Promise<T> {
  const response = await gemini.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { responseMimeType: "application/json", temperature },
  });

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
  const response = await gemini.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { temperature },
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.text || "";
}
