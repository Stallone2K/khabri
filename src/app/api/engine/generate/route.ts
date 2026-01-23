import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import {
  BHUPEN_MASTER_PROMPT,
  BLOG_RESEARCH_MASTER_PROMPT,
  // ... other prompts
} from "@/lib/prompts";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  const { type, topic, researchData, projectBrief } = await req.json();
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

  let prompt = "";

  if (type === "BHUPEN_SCRIPT") {
    prompt = `${BHUPEN_MASTER_PROMPT}\n\nPROJECT BRIEF:\n${JSON.stringify(projectBrief)}\n\nRESEARCH_PACK:\n${JSON.stringify(researchData)}`;
  } else if (type === "BLOG_RESEARCH") {
    prompt = BLOG_RESEARCH_MASTER_PROMPT.replace("{PASTE TOPIC HERE}", topic);
    if (researchData) prompt += `\n\nADDITIONAL CONTEXT:\n${researchData}`;
  }
  // ... handle other types

  const result = await model.generateContent(prompt);
  const response = await result.response;

  return NextResponse.json({ output: response.text() });
}
