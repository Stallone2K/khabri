import { prisma } from "@/lib/prisma";
import { generateJSON } from "@/lib/gemini";
import { buildSubNarrativePrompt } from "@/lib/prompts";

const MODEL = "gemini-2.0-flash";

interface SubNarrative {
  title: string;
  summary: string;
  keywords: string[];
}

/**
 * Auto-discover sub-narratives for a node when it has 5+ events and no children.
 * Only splits nodes at depth 0 or 1 (max 2 levels of splitting).
 */
export async function discoverSubNarratives(
  nodeId: string,
  nodeTitle: string,
  projectId: string,
): Promise<number> {
  // Check preconditions
  const node = await prisma.narrativeNode.findUnique({
    where: { id: nodeId },
    include: {
      events: { orderBy: { createdAt: "desc" }, take: 20 },
      children: { select: { id: true } },
    },
  });

  if (!node) return 0;
  if (node.children.length > 0) return 0; // already has children
  if (node.events.length < 5) return 0; // not enough events

  // Compute depth: count parents up to root
  let depth = 0;
  let currentParentId = node.parentId;
  while (currentParentId && depth < 3) {
    const parent = await prisma.narrativeNode.findUnique({
      where: { id: currentParentId },
      select: { parentId: true },
    });
    if (!parent) break;
    depth++;
    currentParentId = parent.parentId;
  }

  if (depth >= 2) return 0; // too deep to split

  // Call AI to discover sub-narratives
  const prompt = buildSubNarrativePrompt(
    nodeTitle,
    node.events.map((e) => ({
      title: e.title,
      summary: e.summary,
      createdAt: e.createdAt.toISOString().split("T")[0],
    })),
  );

  const subNarratives = await generateJSON<SubNarrative[]>(MODEL, prompt, 0.3);

  if (!Array.isArray(subNarratives) || subNarratives.length === 0) return 0;

  // Create child nodes (max 3)
  const toCreate = subNarratives.slice(0, 3).filter((s) => s.title?.trim());
  let created = 0;

  for (const sub of toCreate) {
    await prisma.narrativeNode.create({
      data: {
        projectId,
        parentId: nodeId,
        title: sub.title.trim(),
        summary: sub.summary?.trim() || null,
        keywords: (sub.keywords || []).map((k) => k.toLowerCase().trim()).filter(Boolean),
      },
    });
    created++;
  }

  return created;
}
