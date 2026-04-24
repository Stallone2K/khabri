import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { type Tool } from "@google/genai";
import { gemini } from "@/lib/gemini";
import { UNIFIED_RESEARCH_AGENT_PROMPT } from "@/lib/prompts";

// Types for Grounding Metadata
interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
  groundingSupports?: any[];
  searchEntryPoint?: any;
}

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

    // 2. Prepare the Initial Prompt
    const promptText = UNIFIED_RESEARCH_AGENT_PROMPT.replace(
      "{title}",
      project.title,
    )
      .replace("{notes}", brief?.notes || "None")
      .replace("{url}", brief?.originalUrl || "None");

    // ---------------------------------------------------------
    // 3. EXECUTE DEEP RESEARCH (Multi-Turn Loop)
    // ---------------------------------------------------------
    const conversationHistory: any[] = [];
    let accumulatedResearch = "";
    const allSources = new Map<string, { title: string; url: string }>();

    // We start the conversation
    conversationHistory.push({
      role: "user",
      parts: [{ text: promptText }],
    });

    const RESEARCH_ITERATIONS = 2; // 2 dense iterations is usually enough

    // Configure Tools: Google Search (Interactions)
    const tools: Tool[] = [
      {
        googleSearch: {},
      },
    ];

    for (let iteration = 0; iteration < RESEARCH_ITERATIONS; iteration++) {
      console.log(
        `🔍 Research Iteration ${iteration + 1}/${RESEARCH_ITERATIONS}`,
      );

      const response = await gemini.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: conversationHistory,
        config: {
          tools: tools,
          temperature: 0.7, // Allow some creativity in finding new angles
        },
      });

      const candidate = response.candidates?.[0];
      const responseText = candidate?.content?.parts?.[0]?.text || "";

      if (!responseText) {
        console.warn(`Research iteration ${iteration + 1} produced no text.`);
        break;
      }

      // Collect the raw data
      accumulatedResearch += `--- RESEARCH NOTES BATCH ${iteration + 1} ---\n${responseText}\n\n`;

      // Collect Sources from Grounding Metadata
      const groundingMetadata = candidate?.groundingMetadata as GroundingMetadata;
      if (groundingMetadata?.groundingChunks) {
        groundingMetadata.groundingChunks.forEach((chunk) => {
          if (chunk.web?.uri && chunk.web?.title) {
            allSources.set(chunk.web.uri, {
              title: chunk.web.title,
              url: chunk.web.uri,
            });
          }
        });
      }

      // Add to history so the model remembers context
      conversationHistory.push({
        role: "model",
        parts: [{ text: responseText }],
      });

      // Ask for deeper details if not the last iteration
      if (iteration < RESEARCH_ITERATIONS - 1) {
        conversationHistory.push({
          role: "user",
          parts: [
            {
              text: "Dig deeper. Find specific quotes, hard statistics, and verify the timeline dates. Look for contrarian views or under-reported angles.",
            },
          ],
        });
      }
    }

    // ---------------------------------------------------------
    // 4. THE SYNTHESIS STEP (Formatting the Output)
    // ---------------------------------------------------------
    console.log("✨ Synthesizing Final Dossier...");

    const synthesisPrompt = `
      You are the Chief Editor.
      I have gathered raw research notes from a deep-dive investigation.
      
      YOUR TASK:
      Consolidate the notes below into ONE single, perfectly formatted Master Intelligence Dossier.
      Ignore conversational filler. Focus on density and structure.
      
      STRICT OUTPUT FORMAT (Markdown):
      
      # {Project Title}

      ## 1. STRATEGIC OVERVIEW
      - **The Hook:** (One sentence summary)
      - **Target Audience:**
      - **Primary Angle:**
      - **Risk Level:**

      ## 2. THE HARD FACTS (5W1H)
      - **What Happened:**
      - **The Trigger:**
      - **Key Entities:**
      - **The Numbers:** (List critical stats)
      - **Status:** (Confirmed vs Alleged)

      ## 3. CHRONOLOGICAL TIMELINE
      - **YYYY-MM-DD:** Event [Source]

      ## 4. THE "SYSTEM" VIEW
      - **The Mechanism:**
      - **The Incentives:**
      - **The Failure Point:**

      ## 5. STAKEHOLDER MAP
      - **Protagonists:**
      - **Antagonists:**

      ## 6. ASSET HUNT
      ### A. Quote Bank
      ### B. Visual Opportunities
      ### C. Claims & Rumors Map

      ## 7. CONTENT ANGLES
      - **Viral Angle:**
      - **Contrarian Angle:**
      - **Data-Led Angle:**

      ---
      RAW RESEARCH NOTES TO PROCESS:
      ${accumulatedResearch}
    `;

    // Final Call to format everything nicely
    const finalResponse = await gemini.models.generateContent({
      model: "gemini-2.5-flash", // Fast synthesizer
      contents: [{ role: "user", parts: [{ text: synthesisPrompt }] }],
      config: { temperature: 0.1 }, // Strict formatting
    });

    let finalDossier =
      finalResponse.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // ---------------------------------------------------------
    // 5. APPEND VERIFIED SOURCES
    // ---------------------------------------------------------
    if (allSources.size > 0) {
      let sourcesList = "\n\n## 8. VERIFIED SOURCE LIST\n";
      allSources.forEach((source) => {
        sourcesList += `- [${source.title}](${source.url})\n`;
      });

      // Append to the end
      finalDossier += sourcesList;
    }

    if (!finalDossier) throw new Error("Failed to generate final dossier");

    console.log(`✅ Research completed with ${allSources.size} sources`);

    // 6. Save to Database
    await prisma.project.update({
      where: { id: projectId },
      data: {
        researchData: finalDossier,
        status: "RESEARCH_DONE",
      },
    });

    return NextResponse.json({
      success: true,
      dossier: finalDossier,
      sourcesCount: allSources.size,
    });
  } catch (error: any) {
    console.error("Deep Research Failed:", error);
    return new NextResponse(`Deep Research Failed: ${error.message}`, {
      status: 500,
    });
  }
}
