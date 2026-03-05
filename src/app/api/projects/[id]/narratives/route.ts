import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — return full narrative tree for a project
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

  // Fetch all nodes with events
  const nodes = await prisma.narrativeNode.findMany({
    where: { projectId: id },
    include: {
      events: { orderBy: { createdAt: "desc" }, take: 10 },
    },
    orderBy: { createdAt: "asc" },
  });

  // Fetch stakeholders separately (safe if table is new)
  let stakeholdersByNode: Record<string, any[]> = {};
  try {
    const allStakeholders = await prisma.narrativeStakeholder.findMany({
      where: { nodeId: { in: nodes.map((n) => n.id) } },
      orderBy: { mentionCount: "desc" },
    });
    for (const s of allStakeholders) {
      if (!stakeholdersByNode[s.nodeId]) stakeholdersByNode[s.nodeId] = [];
      if (stakeholdersByNode[s.nodeId].length < 10) {
        stakeholdersByNode[s.nodeId].push(s);
      }
    }
  } catch {
    // Stakeholder table may not be available yet
  }

  // Build tree structure
  const root = nodes.find((n) => n.parentId === null);
  if (!root) {
    return NextResponse.json({ root: null, nodes: [] });
  }

  const childMap = new Map<string, typeof nodes>();
  for (const node of nodes) {
    if (node.parentId) {
      const siblings = childMap.get(node.parentId) || [];
      siblings.push(node);
      childMap.set(node.parentId, siblings);
    }
  }

  function buildTree(node: (typeof nodes)[0]): any {
    return {
      ...node,
      stakeholders: stakeholdersByNode[node.id] || [],
      children: (childMap.get(node.id) || []).map(buildTree),
    };
  }

  return NextResponse.json({ root: buildTree(root) });
}

// POST — manually add a narrative node
export async function POST(
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

  const body = await req.json();
  const { title, parentId, summary, keywords } = body;

  if (!title?.trim()) {
    return NextResponse.json(
      { error: "Title is required" },
      { status: 400 },
    );
  }

  // If no parentId, find the root node
  let resolvedParentId = parentId;
  if (!resolvedParentId) {
    const root = await prisma.narrativeNode.findFirst({
      where: { projectId: id, parentId: null },
    });
    resolvedParentId = root?.id || null;
  }

  const node = await prisma.narrativeNode.create({
    data: {
      projectId: id,
      parentId: resolvedParentId,
      title: title.trim(),
      summary: summary?.trim() || null,
      keywords: keywords || [],
    },
  });

  return NextResponse.json(node);
}
