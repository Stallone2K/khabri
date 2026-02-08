import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GoogleGenAI } from "@google/genai";
import { UNIFIED_RESEARCH_AGENT_PROMPT } from "@/lib/prompts";

// Initialize the new Client
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  // 1. Validation
  if (!process.env.GEMINI_API_KEY) {
    return new NextResponse("Server Error: Missing GEMINI_API_KEY", {
      status: 500,
    });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { projectId } = await req.json();

  const project = await prisma.project.findUnique({
    where: { id: projectId, userId: session.user.id },
  });

  if (!project) return new NextResponse("Project not found", { status: 404 });

  try {
    const brief = project.brief as any;

    // 2. Prepare the "Deep Research" Prompt
    const promptText = UNIFIED_RESEARCH_AGENT_PROMPT.replace(
      "{title}",
      project.title,
    )
      .replace("{notes}", brief?.notes || "None")
      .replace("{url}", brief?.originalUrl || "None");

    // 3. EXECUTE DEEP RESEARCH (Gemini 3 Pro + Google Search)
    // We use 'as any' to bypass TypeScript errors with the new SDK types.
    const response = await client.models.generateContent({
      model: "gemini-3-pro-preview", // <--- SWITCHED TO MODEL 3 PRO
      contents: [
        {
          role: "user",
          parts: [{ text: promptText }],
        },
      ],
      config: {
        // ✅ FORCE GOOGLE SEARCH
        tools: [{ googleSearch: {} }],
        // ✅ STRICT MODE
        temperature: 0.0,
      } as any,
    });

    // 4. Extract Text
    const candidate = response.candidates?.[0];
    let dossier = candidate?.content?.parts?.[0]?.text || "";

    // 5. EXTRACT & APPEND REAL SOURCES (Grounding Metadata)
    // This fixes the "Hypothetical Source" issue by grabbing the actual URLs the model used.
    const groundingMetadata = candidate?.groundingMetadata as any;

    if (groundingMetadata?.groundingChunks) {
      let sourcesList = "\n\n## 8. VERIFIED SOURCE LIST (DETECTED)\n";
      let hasSources = false;

      groundingMetadata.groundingChunks.forEach((chunk: any, index: number) => {
        if (chunk.web?.uri && chunk.web?.title) {
          sourcesList += `- [${chunk.web.title}](${chunk.web.uri})\n`;
          hasSources = true;
        }
      });

      if (hasSources) {
        // Append sources if they aren't already in the text
        if (!dossier.includes("## 8. SOURCE LIST")) {
          dossier += sourcesList;
        }
      }
    }

    if (!dossier) throw new Error("Empty response from AI");

    // 6. Save to Database
    await prisma.project.update({
      where: { id: projectId },
      data: {
        researchData: dossier,
        status: "RESEARCH_DONE",
      },
    });

    return NextResponse.json({ success: true, dossier });
  } catch (error: any) {
    console.error("Deep Research Failed:", error);
    return new NextResponse(`Deep Research Failed: ${error.message}`, {
      status: 500,
    });
  }
}
