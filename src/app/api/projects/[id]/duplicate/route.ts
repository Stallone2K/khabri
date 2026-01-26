import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // 1. Get Original Project
    const original = await prisma.project.findUnique({
      where: { id: params.id, userId: session.user.id },
    });

    if (!original)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    // 2. Clone it
    const copy = await prisma.project.create({
      data: {
        title: `${original.title} (Copy)`,
        type: original.type,
        status: "DRAFT", // Reset status to draft
        brief: original.brief as any, // Copy brief
        researchData: original.researchData, // Copy research
        userId: session.user.id,
      },
    });

    return NextResponse.json(copy);
  } catch (error) {
    return NextResponse.json({ error: "Failed to duplicate" }, { status: 500 });
  }
}
