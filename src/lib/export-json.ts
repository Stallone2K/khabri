import { prisma } from "@/lib/prisma";

/**
 * Export full project data as structured JSON.
 */
export async function exportProjectJSON(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      brief: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!project) return null;

  const nodes = await prisma.narrativeNode.findMany({
    where: { projectId },
    include: {
      events: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Fetch stakeholders separately
  const stakeholdersByNode: Record<string, any[]> = {};
  try {
    const allStakeholders = await prisma.narrativeStakeholder.findMany({
      where: { nodeId: { in: nodes.map((n) => n.id) } },
      orderBy: { mentionCount: "desc" },
    });
    for (const s of allStakeholders) {
      if (!stakeholdersByNode[s.nodeId]) stakeholdersByNode[s.nodeId] = [];
      stakeholdersByNode[s.nodeId].push(s);
    }
  } catch {
    // Table may not exist yet
  }

  // Build tree
  const root = nodes.find((n) => n.parentId === null);
  if (!root) {
    return { ...project, narratives: null };
  }

  const childMap = new Map<string, typeof nodes>();
  for (const node of nodes) {
    if (node.parentId) {
      const siblings = childMap.get(node.parentId) || [];
      siblings.push(node);
      childMap.set(node.parentId, siblings);
    }
  }

  function buildTree(node: (typeof nodes)[0]): any {
    const nodeStakeholders = stakeholdersByNode[node.id] || [];
    return {
      id: node.id,
      title: node.title,
      summary: node.summary,
      keywords: node.keywords,
      status: node.status,
      arcPhase: node.arcPhase,
      signalCount: node.signalCount,
      lastSignalAt: node.lastSignalAt,
      createdAt: node.createdAt,
      events: node.events.map((e) => ({
        id: e.id,
        title: e.title,
        summary: e.summary,
        sourceUrl: e.sourceUrl,
        impactScore: e.impactScore,
        sentiment: e.sentiment,
        createdAt: e.createdAt,
      })),
      stakeholders: nodeStakeholders.map((s: any) => ({
        name: s.name,
        type: s.type,
        role: s.role,
        sentiment: s.sentiment,
        mentionCount: s.mentionCount,
      })),
      children: (childMap.get(node.id) || []).map(buildTree),
    };
  }

  return {
    ...project,
    exportedAt: new Date().toISOString(),
    narratives: buildTree(root),
  };
}
