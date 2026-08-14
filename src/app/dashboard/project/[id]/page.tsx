import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { NarrativeTreeView } from "@/components/project/narrative-tree";

interface PageProps {
	params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: PageProps) {
	const session = await getServerSession(authOptions);
	if (!session?.user) redirect("/");

	const { id } = await params;
	const project = await prisma.project.findUnique({
		where: {
			id,
			userId: session.user.id,
		},
		select: {
			id: true,
			title: true,
			status: true,
		},
	});

	if (!project) return notFound();

	return <NarrativeTreeView project={project} />;
}
