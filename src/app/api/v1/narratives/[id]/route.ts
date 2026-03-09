import { prisma } from "@/lib/prisma";
import {
  authenticateV1,
  isAuthResult,
  v1Success,
  v1Error,
  logV1Usage,
} from "@/lib/api-v1";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const startTime = Date.now();
  const authResult = await authenticateV1(req, "narratives");
  if (!isAuthResult(authResult)) return authResult;
  const auth = authResult;

  try {
    const { id } = await params;

    // Verify ownership: node → project → user
    const node = await prisma.narrativeNode.findUnique({
      where: { id },
      select: { projectId: true },
    });

    if (!node) {
      logV1Usage(auth, req, 404, startTime);
      return v1Error("NOT_FOUND", "Narrative not found", 404, auth);
    }

    const project = await prisma.project.findUnique({
      where: { id: node.projectId },
      select: { userId: true },
    });

    if (!project || project.userId !== auth.userId) {
      logV1Usage(auth, req, 404, startTime);
      return v1Error("NOT_FOUND", "Narrative not found", 404, auth);
    }

    // Fetch all nodes in this subtree
    const allNodes = await prisma.narrativeNode.findMany({
      where: { projectId: node.projectId },
      include: {
        events: { orderBy: { createdAt: "desc" }, take: 10 },
      },
      orderBy: { createdAt: "asc" },
    });

    // Fetch stakeholders
    const nodeIds = allNodes.map((n) => n.id);
    let stakeholdersByNode: Record<string, unknown[]> = {};
    try {
      const allStakeholders = await prisma.narrativeStakeholder.findMany({
        where: { nodeId: { in: nodeIds } },
        orderBy: { mentionCount: "desc" },
        select: {
          nodeId: true,
          name: true,
          type: true,
          role: true,
          sentiment: true,
          mentionCount: true,
          lastSeenAt: true,
        },
      });
      for (const s of allStakeholders) {
        if (!stakeholdersByNode[s.nodeId]) stakeholdersByNode[s.nodeId] = [];
        if ((stakeholdersByNode[s.nodeId] as unknown[]).length < 10) {
          const { nodeId: _, ...rest } = s;
          (stakeholdersByNode[s.nodeId] as unknown[]).push(rest);
        }
      }
    } catch {
      // Stakeholder table may not be available yet
    }

    // Build tree from the target node
    const childMap = new Map<string, typeof allNodes>();
    for (const n of allNodes) {
      if (n.parentId) {
        const siblings = childMap.get(n.parentId) || [];
        siblings.push(n);
        childMap.set(n.parentId, siblings);
      }
    }

    function buildTree(n: (typeof allNodes)[0]): Record<string, unknown> {
      return {
        id: n.id,
        title: n.title,
        summary: n.summary,
        keywords: n.keywords,
        status: n.status,
        signalCount: n.signalCount,
        lastSignalAt: n.lastSignalAt,
        arcPhase: n.arcPhase,
        events: n.events.map((e) => ({
          id: e.id,
          title: e.title,
          summary: e.summary,
          sourceUrl: e.sourceUrl,
          impactScore: e.impactScore,
          sentiment: e.sentiment,
          createdAt: e.createdAt,
        })),
        stakeholders: stakeholdersByNode[n.id] || [],
        children: (childMap.get(n.id) || []).map(buildTree),
      };
    }

    const targetNode = allNodes.find((n) => n.id === id);
    if (!targetNode) {
      logV1Usage(auth, req, 404, startTime);
      return v1Error("NOT_FOUND", "Narrative not found", 404, auth);
    }

    logV1Usage(auth, req, 200, startTime);
    return v1Success(auth, buildTree(targetNode));
  } catch (error) {
    console.error("[V1/NARRATIVES/ID] Error:", error);
    logV1Usage(auth, req, 500, startTime);
    return v1Error("INTERNAL_ERROR", "Failed to fetch narrative", 500, auth);
  }
}
