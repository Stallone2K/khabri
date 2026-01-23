import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { TREND_ENGINE_PROMPT } from "@/lib/prompts";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  const { signals } = await req.json();

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); // Or your preferred model

  const signalText = signals
    .map((s: any) => `- [${s.source}] ${s.title} (Link: ${s.url})`)
    .join("\n");

  const prompt = `${TREND_ENGINE_PROMPT}\n\nRAW SIGNALS:\n${signalText}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  // Parse JSON from text (handle markdown fences if needed)
  const jsonString = text.replace(/```json|```/g, "").trim();
  const rankedTrends = JSON.parse(jsonString);

  // Save to DB (RankedTrend table) here...

  return NextResponse.json({ rankedTrends });
}
