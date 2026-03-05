import { prisma } from "@/lib/prisma";

/**
 * Export full project data as structured Markdown.
 */
export async function exportProjectMarkdown(projectId: string): Promise<string | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!project) return null;

  const nodes = await prisma.narrativeNode.findMany({
    where: { projectId },
    include: {
      events: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Fetch stakeholders separately
  const stakeholdersByNode: Record<string, any[]> = {};
  try {
    const allStakeholders = await prisma.narrativeStakeholder.findMany({
      where: { nodeId: { in: nodes.map((n) => n.id) } },
      orderBy: { mentionCount: "desc" },
    });
    for (const s of allStakeholders) {
      if (!stakeholdersByNode[s.nodeId]) stakeholdersByNode[s.nodeId] = [];
      stakeholdersByNode[s.nodeId].push(s);
    }
  } catch {
    // Table may not exist yet
  }

  const root = nodes.find((n) => n.parentId === null);
  if (!root) {
    return `# ${project.title}\n\n*No narrative data available.*\n`;
  }

  const childMap = new Map<string, typeof nodes>();
  for (const node of nodes) {
    if (node.parentId) {
      const siblings = childMap.get(node.parentId) || [];
      siblings.push(node);
      childMap.set(node.parentId, siblings);
    }
  }

  const lines: string[] = [];

  lines.push(`# ${project.title}`);
  lines.push("");
  lines.push(`**Status:** ${project.status}  `);
  lines.push(`**Created:** ${project.createdAt.toISOString().split("T")[0]}  `);
  lines.push(`**Last Updated:** ${project.updatedAt.toISOString().split("T")[0]}  `);
  lines.push(`**Exported:** ${new Date().toISOString().split("T")[0]}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  function renderNode(node: (typeof nodes)[0], depth: number) {
    const prefix = "#".repeat(Math.min(depth + 2, 6));
    const phaseTag = node.arcPhase ? ` \`${node.arcPhase}\`` : "";
    const statusTag = node.status !== "ACTIVE" ? ` *(${node.status})*` : "";

    lines.push(`${prefix} ${node.title}${phaseTag}${statusTag}`);
    lines.push("");

    if (node.summary) {
      lines.push(`> ${node.summary}`);
      lines.push("");
    }

    if (node.keywords.length > 0) {
      lines.push(`**Keywords:** ${node.keywords.join(", ")}`);
      lines.push("");
    }

    // Stakeholders
    const nodeStakeholders = stakeholdersByNode[node.id] || [];
    if (nodeStakeholders.length > 0) {
      lines.push("**Key Stakeholders:**");
      for (const s of nodeStakeholders) {
        lines.push(`- **${s.name}** (${s.type}) — ${s.mentionCount} mentions`);
      }
      lines.push("");
    }

    // Events
    if (node.events.length > 0) {
      lines.push("**Events:**");
      for (const e of node.events) {
        const date = e.createdAt.toISOString().split("T")[0];
        const impact = e.impactScore > 0 ? ` [Impact: ${e.impactScore}]` : "";
        const sentiment = e.sentiment ? ` (${e.sentiment})` : "";
        const summary = e.summary ? ` — ${e.summary}` : "";
        const url = e.sourceUrl ? ` ([source](${e.sourceUrl}))` : "";
        lines.push(`- **${date}:** ${e.title}${summary}${impact}${sentiment}${url}`);
      }
      lines.push("");
    }

    // Recurse children
    const children = childMap.get(node.id) || [];
    for (const child of children) {
      renderNode(child, depth + 1);
    }
  }

  renderNode(root, 0);

  return lines.join("\n");
}
