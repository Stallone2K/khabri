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
  const authResult = await authenticateV1(req, "trends");
  if (!isAuthResult(authResult)) return authResult;
  const auth = authResult;

  try {
    const { id } = await params;

    const trend = await prisma.rankedTrend.findFirst({
      where: { id, userId: auth.userId },
    });

    if (!trend) {
      logV1Usage(auth, req, 404, startTime);
      return v1Error("NOT_FOUND", "Trend not found", 404, auth);
    }

    logV1Usage(auth, req, 200, startTime);
    return v1Success(auth, trend);
  } catch (error) {
    console.error("[V1/TRENDS/ID] Error:", error);
    logV1Usage(auth, req, 500, startTime);
    return v1Error("INTERNAL_ERROR", "Failed to fetch trend", 500, auth);
  }
}
