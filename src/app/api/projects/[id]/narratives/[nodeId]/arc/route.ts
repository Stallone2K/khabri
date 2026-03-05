import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeNarrativeArc } from "@/lib/narrative-arc";

// GET — return arc data (daily aggregates + phase) for a narrative node
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; nodeId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, nodeId } = await params;

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id, userId: session.user.id },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Verify node belongs to project
  const node = await prisma.narrativeNode.findFirst({
    where: { id: nodeId, projectId: id },
    select: { id: true },
  });

  if (!node) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  const arc = await computeNarrativeArc(nodeId);

  return NextResponse.json(arc);
}
