import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { discoverNarratives } from "@/lib/narrative-discovery";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projects = await prisma.project.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        updatedAt: true,
        brief: true, // <--- ADD THIS LINE so Sidebar can read the URL
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 },
    );
  }
}

// Optional: Quick Create Endpoint for the "+" button
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, type, brief } = body;

  const isTrackedTrend = type === "TRACKED_TREND";

  const newProject = await prisma.project.create({
    data: {
      title: title || "Untitled Project",
      type: type || "TRACKED_TREND",
      status: isTrackedTrend ? "DISCOVERING" : "DRAFT",
      userId: session.user.id,
      brief: brief ? (brief as any) : undefined,
    },
  });

  // Auto-discover narratives in the background for tracked trends
  if (isTrackedTrend && newProject.title) {
    runNarrativeDiscovery(newProject.id, newProject.title).catch((err) =>
      console.error("[NARRATIVE] Background discovery failed:", err),
    );
  }

  return NextResponse.json(newProject);
}

/** Background narrative discovery — runs after response is sent */
async function runNarrativeDiscovery(projectId: string, title: string) {
  try {
    const angles = await discoverNarratives(title);

    // Create root node
    const rootNode = await prisma.narrativeNode.create({
      data: {
        projectId,
        title,
        summary: `Tracking: ${title}`,
        keywords: title
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((w) => w.length > 2),
      },
    });

    // Create child narratives
    if (angles.length > 0) {
      await prisma.narrativeNode.createMany({
        data: angles.map((angle) => ({
          projectId,
          parentId: rootNode.id,
          title: angle.title,
          summary: angle.summary,
          keywords: angle.keywords,
        })),
      });
    }

    await prisma.project.update({
      where: { id: projectId },
      data: { status: "TRACKING" },
    });

    console.log(`[NARRATIVE] Discovered ${angles.length} narratives for "${title}"`);
  } catch (error) {
    console.error("[NARRATIVE] Discovery error:", error);
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "DRAFT" },
    });
  }
}
