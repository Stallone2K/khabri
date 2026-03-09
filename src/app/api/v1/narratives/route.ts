import { prisma } from "@/lib/prisma";
import {
  authenticateV1,
  isAuthResult,
  v1Success,
  v1Error,
  logV1Usage,
  parsePagination,
} from "@/lib/api-v1";

export async function GET(req: Request) {
  const startTime = Date.now();
  const authResult = await authenticateV1(req, "narratives");
  if (!isAuthResult(authResult)) return authResult;
  const auth = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const { page, pageSize, skip } = parsePagination(searchParams);
    const status = searchParams.get("status");
    const arcPhase = searchParams.get("arc_phase");

    // Get user's project IDs
    const projects = await prisma.project.findMany({
      where: { userId: auth.userId },
      select: { id: true },
    });
    const projectIds = projects.map((p) => p.id);

    if (projectIds.length === 0) {
      return v1Success(auth, [], { total: 0, page, pageSize });
    }

    const where: Record<string, unknown> = {
      projectId: { in: projectIds },
      parentId: null, // Root narratives only
    };
    if (status) where.status = status;
    if (arcPhase) where.arcPhase = arcPhase;

    const [nodes, total] = await Promise.all([
      prisma.narrativeNode.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          summary: true,
          keywords: true,
          status: true,
          signalCount: true,
          lastSignalAt: true,
          arcPhase: true,
          projectId: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { children: true, events: true, stakeholders: true } },
        },
      }),
      prisma.narrativeNode.count({ where }),
    ]);

    const data = nodes.map((n) => ({
      id: n.id,
      title: n.title,
      summary: n.summary,
      keywords: n.keywords,
      status: n.status,
      signalCount: n.signalCount,
      lastSignalAt: n.lastSignalAt,
      arcPhase: n.arcPhase,
      projectId: n.projectId,
      childCount: n._count.children,
      eventCount: n._count.events,
      stakeholderCount: n._count.stakeholders,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    }));

    logV1Usage(auth, req, 200, startTime);
    return v1Success(auth, data, { total, page, pageSize });
  } catch (error) {
    console.error("[V1/NARRATIVES] Error:", error);
    logV1Usage(auth, req, 500, startTime);
    return v1Error("INTERNAL_ERROR", "Failed to fetch narratives", 500, auth);
  }
}
