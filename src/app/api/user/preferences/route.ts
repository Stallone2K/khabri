import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { ALL_CATEGORIES } from "@/lib/categories";

export async function GET() {
	const userId = await getAuthenticatedUserId();
	if (!userId) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			preferredCategories: true,
			hasCompletedOnboarding: true,
		},
	});

	return NextResponse.json({
		preferredCategories: user?.preferredCategories || [],
		hasCompletedOnboarding: user?.hasCompletedOnboarding || false,
	});
}

export async function PUT(req: Request) {
	const userId = await getAuthenticatedUserId();
	if (!userId) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { categories } = await req.json();

	if (!Array.isArray(categories)) {
		return NextResponse.json(
			{ error: "categories must be an array" },
			{ status: 400 }
		);
	}

	const validCategories = categories.filter((c: string) =>
		ALL_CATEGORIES.includes(c as (typeof ALL_CATEGORIES)[number])
	);

	await prisma.user.update({
		where: { id: userId },
		data: {
			preferredCategories: validCategories,
			hasCompletedOnboarding: true,
		},
	});

	return NextResponse.json({
		success: true,
		preferredCategories: validCategories,
	});
}
