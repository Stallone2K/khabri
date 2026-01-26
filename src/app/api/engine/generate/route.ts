import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // Ensure you have this export
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth"; // Ensure you have this
import {
  BHUPEN_MASTER_PROMPT,
  BLOG_RESEARCH_MASTER_PROMPT,
  BLOG_ENGINE_MASTER_PROMPT,
  TWITTER_RESEARCH_MASTER_PROMPT,
  TWITTER_CONTENT_ENGINE_MASTER_PROMPT,
  BHUPEN_RESEARCH_PACK_BUILDER_PROMPT,
} from "@/lib/prompts";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Helper to get model config
const getModel = (modelName = "gemini-1.5-pro") => {
  return genAI.getGenerativeModel({ model: modelName });
};

export async function POST(req: Request) {
  // 1. Auth Check
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse Payload
  const body = await req.json();
  const {
    projectId,
    action, // 'DEEP_RESEARCH', 'BLOG_DOSSIER', 'TWITTER_DOSSIER', 'BLOG_WRITE', 'TWITTER_WRITE', 'BHUPEN_SCRIPT'
    topic,
    additionalContext, // For datasets, drafts, etc.
    modelOverride,
  } = body;

  const model = getModel(modelOverride || "gemini-1.5-pro");

  try {
    let resultText = "";

    // Fetch Project State if ID provided
    let project = null;
    if (projectId) {
      project = await prisma.project.findUnique({ where: { id: projectId } });
    }

    // ==========================================
    // 🧠 LOGIC ROUTER (Matches Python Script)
    // ==========================================

    switch (action) {
      // ----------------------------------------
      // 1. DEEP RESEARCH (Agentic Fallback)
      // ----------------------------------------
      // Note: The Node SDK for "Interactions/Agents" is experimental.
      // We will use a standard high-intelligence prompt simulation here
      // unless you have the specific Vertex AI Agent Client for Node.
      case "DEEP_RESEARCH":
        const researchPrompt = `
          You are a Deep Research Agent. 
          Topic: ${topic}
          Task: Perform a deep, comprehensive research report. 
          Include: Key facts, timeline, statistics, stakeholder positions, and checking for contradictions.
          CITE EVERYTHING.
        `;
        const researchResult = await model.generateContent(researchPrompt);
        resultText = researchResult.response.text();

        // Save to DB
        if (projectId) {
          await prisma.project.update({
            where: { id: projectId },
            data: { researchData: resultText, status: "RESEARCHED" },
          });
        }
        break;

      // ----------------------------------------
      // 2. BLOG RESEARCH DOSSIER
      // ----------------------------------------
      case "BLOG_DOSSIER":
        let blogResPrompt = BLOG_RESEARCH_MASTER_PROMPT.replace(
          "{PASTE TOPIC HERE}",
          topic,
        );
        if (project?.researchData) {
          blogResPrompt += `\n\nADDITIONAL CONTEXT (Deep Research Report):\n${project.researchData}`;
        }
        const blogResResult = await model.generateContent(blogResPrompt);
        resultText = blogResResult.response.text();

        // Update Project
        if (projectId) {
          await prisma.project.update({
            where: { id: projectId },
            data: { researchData: resultText, status: "RESEARCHED" }, // We treat dossier as refined research
          });
        }
        break;

      // ----------------------------------------
      // 3. TWITTER RESEARCH DOSSIER
      // ----------------------------------------
      case "TWITTER_DOSSIER":
        let twResPrompt = TWITTER_RESEARCH_MASTER_PROMPT.replace(
          "[PASTE TOPIC HERE]",
          topic,
        );
        if (project?.researchData) {
          twResPrompt += `\n\nADDITIONAL CONTEXT (Deep Research Report):\n${project.researchData}`;
        }
        const twResResult = await model.generateContent(twResPrompt);
        resultText = twResResult.response.text();

        if (projectId) {
          await prisma.project.update({
            where: { id: projectId },
            data: { researchData: resultText, status: "RESEARCHED" },
          });
        }
        break;

      // ----------------------------------------
      // 4. BLOG WRITE (Voice-Lock)
      // ----------------------------------------
      case "BLOG_WRITE":
        const blogResearch =
          project?.researchData || additionalContext?.research || "";
        const styleDataset = additionalContext?.style || ""; // User must provide this from UI or DB

        let blogWritePrompt = BLOG_ENGINE_MASTER_PROMPT;
        blogWritePrompt += `\n\nTOPIC:\n${topic}`;
        blogWritePrompt += `\n\nRESEARCH PACK:\n${blogResearch}`;
        blogWritePrompt += `\n\nSTYLE DATASET:\n${styleDataset}`;

        const blogWriteResult = await model.generateContent(blogWritePrompt);
        resultText = blogWriteResult.response.text();

        if (projectId) {
          await prisma.project.update({
            where: { id: projectId },
            data: {
              finalOutput: resultText,
              status: "COMPLETED",
              type: "BLOG_POST",
            },
          });
        }
        break;

      // ----------------------------------------
      // 5. TWITTER CONTENT WRITE
      // ----------------------------------------
      case "TWITTER_WRITE":
        const twResearch =
          project?.researchData || additionalContext?.research || "";

        let twWritePrompt = TWITTER_CONTENT_ENGINE_MASTER_PROMPT.replace(
          "[PASTE TOPIC(S)]",
          topic,
        ).replace("[PASTE RESEARCH]", twResearch);

        const twWriteResult = await model.generateContent(twWritePrompt);
        resultText = twWriteResult.response.text();

        if (projectId) {
          await prisma.project.update({
            where: { id: projectId },
            data: {
              finalOutput: resultText,
              status: "COMPLETED",
              type: "TWITTER_THREAD",
            },
          });
        }
        break;

      // ----------------------------------------
      // 6. BHUPEN SCRIPT ENGINE
      // ----------------------------------------
      case "BHUPEN_SCRIPT":
        // A. Build Research Pack JSON first (Internal Step)
        const rawResearch =
          project?.researchData || additionalContext?.research || "";
        const packBuilderPrompt = `${BHUPEN_RESEARCH_PACK_BUILDER_PROMPT}\n\nTOPIC:\n${topic}\n\nRESEARCH MATERIAL:\n${rawResearch}`;

        const packResult = await model.generateContent(packBuilderPrompt);
        const researchPackJson = packResult.response.text();

        // B. Generate Script
        const projectBrief = additionalContext?.brief || {
          topic_title: topic,
          platform: "YouTube long",
          target_runtime: "10–15 min",
          language: "Hinglish",
          audience: "India; The Squirrels IN style",
          tone_dial: 6,
        };

        let bhupenPrompt = `${BHUPEN_MASTER_PROMPT}\n\n`;
        bhupenPrompt += `PROJECT BRIEF:\n${JSON.stringify(projectBrief)}\n\n`;
        bhupenPrompt += `MODE 1 — FROM SCRATCH\n\n`;
        // Handle dataset if provided
        if (additionalContext?.dataset) {
          bhupenPrompt += `DATASET (Bhupen style references):\n${additionalContext.dataset}\n\n`;
        }
        // Clean JSON fence for research pack
        const cleanPack = researchPackJson.replace(/```json|```/g, "").trim();
        bhupenPrompt += `RESEARCH_PACK:\n${cleanPack}\n\n`;

        const bhupenResult = await model.generateContent(bhupenPrompt);
        resultText = bhupenResult.response.text();

        if (projectId) {
          await prisma.project.update({
            where: { id: projectId },
            data: {
              finalOutput: resultText,
              status: "COMPLETED",
              type: "BHUPEN_SCRIPT",
            },
          });
        }
        break;

      default:
        return NextResponse.json({ error: "Invalid Action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, output: resultText });
  } catch (error) {
    console.error("Engine Error:", error);
    return NextResponse.json(
      { error: "Generation Failed", details: error },
      { status: 500 },
    );
  }
}
