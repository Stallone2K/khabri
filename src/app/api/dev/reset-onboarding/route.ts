import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/api-auth";

export async function POST() {
	if (process.env.NODE_ENV === "production") {
		return NextResponse.json({ error: "Not available in production" }, { status: 403 });
	}

	const userId = await getAuthenticatedUserId();
	if (!userId) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	await prisma.user.update({
		where: { id: userId },
		data: {
			hasCompletedOnboarding: false,
			preferredCategories: [],
		},
	});

	return NextResponse.json({ success: true, message: "Onboarding reset" });
}
