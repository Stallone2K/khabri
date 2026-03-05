import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exportProjectJSON } from "@/lib/export-json";
import { exportProjectMarkdown } from "@/lib/export-markdown";

// GET /api/projects/[id]/export?format=json|markdown
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "json";

  // Verify ownership
  const project = await prisma.project.findUnique({
    where: { id, userId: session.user.id },
    select: { id: true, title: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const safeName = project.title.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-").toLowerCase();

  if (format === "markdown") {
    const markdown = await exportProjectMarkdown(id);
    if (!markdown) {
      return NextResponse.json({ error: "Export failed" }, { status: 500 });
    }
    return new Response(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}.md"`,
      },
    });
  }

  // Default: JSON
  const data = await exportProjectJSON(id);
  if (!data) {
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}.json"`,
    },
  });
}
