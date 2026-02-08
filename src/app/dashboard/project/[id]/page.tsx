import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { ProjectHeader } from "@/components/project/project-header";
import { ProjectBrief } from "@/components/project/project-brief";
import { ProjectResearch } from "@/components/project/project-research";
import { ProjectEditor } from "@/components/project/project-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormattedDate } from "@/components/ui/formatted-date"; // <--- IMPORT THIS

interface PageProps {
	params: { id: string };
}

export default async function ProjectPage({ params }: PageProps) {
	const session = await getServerSession(authOptions);
	if (!session?.user) redirect("/");

	const project = await prisma.project.findUnique({
		where: {
			id: params.id,
			userId: session.user.id,
		},
	});

	if (!project) return notFound();

	return (
		<div className="flex flex-col h-[calc(100vh-6rem)]">
			{/* 1. HEADER */}
			<ProjectHeader project={project} />

			{/* 2. MAIN WORKSPACE (TABS) */}
			<div className="flex-1 overflow-hidden flex flex-col">
				<Tabs defaultValue="brief" className="h-full flex flex-col">

					{/* TAB NAVIGATION BAR */}
					<div className="flex items-center justify-between px-6 bg-background/50 backdrop-blur-sm z-10">
						{/* Left: Tabs with 'line' variant */}
						<TabsList variant="line" className="w-auto">
							<TabsTrigger value="brief">Brief</TabsTrigger>
							<TabsTrigger value="research">Research</TabsTrigger>
							<TabsTrigger value="editor">Editor</TabsTrigger>
						</TabsList>

						{/* Right: Last Edited Date (Inline) */}
						<div className="text-xs text-muted-foreground font-medium">
							Last Edited <FormattedDate date={project.updatedAt} />
						</div>
					</div>

					{/* TAB 1: BRIEF */}
					<TabsContent value="brief" className="flex-1 overflow-y-auto p-6 bg-muted/5 mt-0">
						<ProjectBrief project={project} />
					</TabsContent>

					{/* TAB 2: RESEARCH */}
					<TabsContent value="research" className="flex-1 overflow-hidden flex flex-col mt-0">
						<ProjectResearch project={project} />
					</TabsContent>

					{/* TAB 3: EDITOR */}
					<TabsContent value="editor" className="flex-1 overflow-hidden flex flex-col mt-0">
						<ProjectEditor project={project} />
					</TabsContent>

				</Tabs>
			</div>
		</div>
	);
}

