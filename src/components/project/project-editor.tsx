"use client";

import { FilePenLine } from "lucide-react";

export function ProjectEditor({ project }: { project: any }) {
	return (
		<div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
			<FilePenLine className="h-12 w-12 opacity-20" />
			<p className="text-sm">Editor workspace is ready to be built.</p>
		</div>
	);
}

