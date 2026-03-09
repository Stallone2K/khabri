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
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const sort = searchParams.get("sort") || "mentions";

    // Verify ownership
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

    // Get all descendant node IDs via recursive CTE
    const descendants = await prisma.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE tree AS (
        SELECT id FROM "NarrativeNode" WHERE id = ${id}
        UNION ALL
        SELECT n.id FROM "NarrativeNode" n JOIN tree t ON n."parentId" = t.id
      )
      SELECT id FROM tree
    `;
    const nodeIds = descendants.map((d) => d.id);

    const where: Record<string, unknown> = { nodeId: { in: nodeIds } };
    if (type) where.type = type;

    const orderBy =
      sort === "sentiment" ? { sentiment: "desc" as const } :
      sort === "name" ? { name: "asc" as const } :
      { mentionCount: "desc" as const };

    const stakeholders = await prisma.narrativeStakeholder.findMany({
      where,
      orderBy,
      select: {
        name: true,
        type: true,
        role: true,
        sentiment: true,
        mentionCount: true,
        lastSeenAt: true,
      },
    });

    logV1Usage(auth, req, 200, startTime);
    return v1Success(auth, stakeholders);
  } catch (error) {
    console.error("[V1/NARRATIVES/STAKEHOLDERS] Error:", error);
    logV1Usage(auth, req, 500, startTime);
    return v1Error("INTERNAL_ERROR", "Failed to fetch stakeholders", 500, auth);
  }
}
