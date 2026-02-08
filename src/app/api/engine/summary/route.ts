import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GoogleGenAI } from "@google/genai"; // <--- NEW SDK

// Initialize the new Client
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { title, context } = await req.json();

  if (!title) return new NextResponse("Title is required", { status: 400 });

  try {
    // 1. Construct the Prompt
    const promptText = `
      You are an expert investigative journalist.
      
      Topic: "${title}"
      User Notes/Context: "${context || "None"}"

      Task: Write a factual, high-density executive summary of this topic.
      Length: Approximately 100 words.
      
      Rules:
      1. Do NOT say "This project focuses on..." or "The summary will cover...".
      2. Start directly with the facts (e.g., "The Indian Air Force has inducted...").
      3. Focus on the "Who, What, Why" of the topic.
      4. If the topic is news, include the latest known developments.
    `;

    // 2. Generate Content using the new SDK syntax
    const response = await client.models.generateContent({
      model: "gemini-2.0-flash", // Using the stable, fast model
      contents: [
        {
          role: "user",
          parts: [{ text: promptText }],
        },
      ],
      config: {
        temperature: 0.3, // Lower temp for factual summaries
      },
    });

    // 3. Extract Text safely
    const summary = response.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!summary) throw new Error("Empty response from AI");

    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error("AI Generation Failed:", error);
    return new NextResponse(`AI Error: ${error.message || "Unknown error"}`, {
      status: 500,
    });
  }
}
