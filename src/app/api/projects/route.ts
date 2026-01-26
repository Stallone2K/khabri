import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth"; // Ensure this path is correct based on your setup
import { prisma } from "@/lib/prisma";

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
  const { title, type } = body;

  const newProject = await prisma.project.create({
    data: {
      title: title || "Untitled Project",
      type: type || "BLOG_POST",
      status: "DRAFT",
      userId: session.user.id,
    },
  });

  return NextResponse.json(newProject);
}
