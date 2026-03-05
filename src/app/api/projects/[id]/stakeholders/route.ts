import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — return all stakeholders for a project (across all narrative nodes)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify ownership
  const project = await prisma.project.findUnique({
    where: { id, userId: session.user.id },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get all narrative node IDs for this project
  const nodeIds = await prisma.narrativeNode.findMany({
    where: { projectId: id },
    select: { id: true },
  });

  // Fetch stakeholders across all nodes
  const stakeholders = await prisma.narrativeStakeholder.findMany({
    where: { nodeId: { in: nodeIds.map((n) => n.id) } },
    orderBy: { mentionCount: "desc" },
  });

  return NextResponse.json({ stakeholders });
}
