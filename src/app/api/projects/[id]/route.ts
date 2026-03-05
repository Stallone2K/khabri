import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

// 1. GET: Load the Project Data
export async function GET(req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id, userId: session.user.id },
  });

  if (!project) return new NextResponse("Not Found", { status: 404 });

  return NextResponse.json(project);
}

// 2. PATCH: Save Changes (Title, Brief, etc.)
export async function PATCH(req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { title, brief, status } = body;

  try {
    const updatedProject = await prisma.project.update({
      where: { id, userId: session.user.id },
      data: {
        ...(title && { title }),
        ...(status && { status }),
        ...(brief && { brief }),
      },
    });

    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error("Failed to update project", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// 3. DELETE: Remove Project
export async function DELETE(req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  await prisma.project.delete({
    where: { id, userId: session.user.id },
  });

  return new NextResponse(null, { status: 204 });
}
