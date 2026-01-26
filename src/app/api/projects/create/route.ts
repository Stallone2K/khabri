import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: Fetch all projects (Keep this as is)
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

// POST: Create a new project (Updated to handle 'brief')
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  // Extract brief from the body as well
  const { title, type, brief } = body;

  const newProject = await prisma.project.create({
    data: {
      title: title || "Untitled Project",
      type: type || "BLOG_POST",
      status: "DRAFT",
      userId: session.user.id,

      // Pass the brief (JSON) if it exists.
      // The 'as any' cast is a safety net if TypeScript is still being stubborn,
      // but 'npx prisma generate' usually fixes it.
      brief: brief ? (brief as any) : undefined,
    },
  });

  return NextResponse.json(newProject);
}
