import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { getUserLimits } from "@/lib/subscription";

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const limits = await getUserLimits(userId);
    return NextResponse.json(limits);
  } catch (error) {
    console.error("[subscription/status] Failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription status" },
      { status: 500 },
    );
  }
}
