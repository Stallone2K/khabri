import { prisma } from "@/lib/prisma";
import { computeNarrativeArc } from "@/lib/narrative-arc";
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

    // Verify ownership
    const node = await prisma.narrativeNode.findUnique({
      where: { id },
      select: { projectId: true, arcPhase: true },
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

    const arc = await computeNarrativeArc(id);

    logV1Usage(auth, req, 200, startTime);
    return v1Success(auth, {
      nodeId: arc.nodeId,
      phase: arc.phase,
      dataPoints: arc.dataPoints,
    });
  } catch (error) {
    console.error("[V1/NARRATIVES/TIMELINE] Error:", error);
    logV1Usage(auth, req, 500, startTime);
    return v1Error("INTERNAL_ERROR", "Failed to fetch timeline", 500, auth);
  }
}
