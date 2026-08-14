import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { discoverNarratives } from "@/lib/narrative-discovery";
import {
  chargeCredits,
  refundCredits,
  CREDIT_COSTS,
  InsufficientCreditsError,
  insufficientCreditsBody,
} from "@/lib/credits";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let charged = 0;
  let chargedUserId: string | null = null;
  let chargedProjectId: string | null = null;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id, userId: session.user.id },
      select: { id: true, title: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    try {
      charged = await chargeCredits(session.user.id, CREDIT_COSTS.NARRATIVE_DISCOVERY, {
        reason: "narrative_discovery",
        refType: "Project",
        refId: id,
      });
      chargedUserId = session.user.id;
      chargedProjectId = id;
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        return NextResponse.json(insufficientCreditsBody(), { status: 402 });
      }
      throw err;
    }

    // Update status to DISCOVERING
    await prisma.project.update({
      where: { id },
      data: { status: "DISCOVERING" },
    });

    // Discover narratives via AI
    const angles = await discoverNarratives(project.title);

    // Create or update root node
    let rootNode = await prisma.narrativeNode.findFirst({
      where: { projectId: id, parentId: null },
    });

    const rootKeywords = project.title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2);

    if (!rootNode) {
      rootNode = await prisma.narrativeNode.create({
        data: {
          projectId: id,
          title: project.title,
          summary: `Tracking: ${project.title}`,
          keywords: rootKeywords,
        },
      });
    } else if (rootNode.title !== project.title) {
      // Title changed — update root and clear stale children
      await prisma.narrativeNode.deleteMany({
        where: { projectId: id, parentId: rootNode.id },
      });
      rootNode = await prisma.narrativeNode.update({
        where: { id: rootNode.id },
        data: {
          title: project.title,
          summary: `Tracking: ${project.title}`,
          keywords: rootKeywords,
        },
      });
    }

    // Get existing child titles to avoid duplicates
    const existingChildren = await prisma.narrativeNode.findMany({
      where: { projectId: id, parentId: rootNode.id },
      select: { title: true },
    });
    const existingTitles = new Set(
      existingChildren.map((c) => c.title.toLowerCase()),
    );

    // Create child narrative nodes (skip duplicates)
    const newNodes = angles.filter(
      (a) => !existingTitles.has(a.title.toLowerCase()),
    );

    if (newNodes.length > 0) {
      await prisma.narrativeNode.createMany({
        data: newNodes.map((angle) => ({
          projectId: id,
          parentId: rootNode.id,
          title: angle.title,
          summary: angle.summary,
          keywords: angle.keywords,
        })),
      });
    }

    // Update project status to TRACKING
    await prisma.project.update({
      where: { id },
      data: { status: "TRACKING" },
    });

    return NextResponse.json({
      success: true,
      discovered: newNodes.length,
    });
  } catch (error: unknown) {
    console.error("Narrative discovery failed:", error);
    if (charged > 0 && chargedUserId) {
      await refundCredits(chargedUserId, charged, {
        reason: "refund",
        refType: "Project",
        refId: chargedProjectId ?? undefined,
      }).catch((e) => console.error("Refund failed:", e));
    }
    const message =
      error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Discovery failed", details: message },
      { status: 500 },
    );
  }
}
