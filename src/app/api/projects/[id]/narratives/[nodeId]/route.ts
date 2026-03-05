import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH — update a narrative node
export async function PATCH(
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

  const body = await req.json();
  const { title, summary, keywords, status } = body;

  const updateData: any = {};
  if (title !== undefined) updateData.title = title.trim();
  if (summary !== undefined) updateData.summary = summary?.trim() || null;
  if (keywords !== undefined) updateData.keywords = keywords;
  if (status !== undefined) updateData.status = status;

  const node = await prisma.narrativeNode.update({
    where: { id: nodeId, projectId: id },
    data: updateData,
  });

  return NextResponse.json(node);
}

// DELETE — delete a narrative node (children cascade)
export async function DELETE(
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

  // Don't allow deleting the root node
  const node = await prisma.narrativeNode.findUnique({
    where: { id: nodeId },
    select: { parentId: true },
  });

  if (!node) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  if (node.parentId === null) {
    return NextResponse.json(
      { error: "Cannot delete root node" },
      { status: 400 },
    );
  }

  // Delete children first (recursive), then the node itself
  await deleteNodeRecursive(nodeId, id);

  return new NextResponse(null, { status: 204 });
}

async function deleteNodeRecursive(nodeId: string, projectId: string) {
  const children = await prisma.narrativeNode.findMany({
    where: { parentId: nodeId, projectId },
    select: { id: true },
  });

  for (const child of children) {
    await deleteNodeRecursive(child.id, projectId);
  }

  await prisma.narrativeNode.delete({ where: { id: nodeId } });
}
