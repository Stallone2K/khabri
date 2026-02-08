"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Share2, MoreVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ProjectHeader({ project }: { project: any }) {
	const router = useRouter();

	return (
		<div className="h-16 shrink-0 flex items-center justify-between px-6 bg-background">
			<div className="flex items-center gap-4">
				<Button variant="ghost" size="icon" onClick={() => router.back()}>
					<ArrowLeft className="h-4 w-4" />
				</Button>
				<div>
					<h1 className="text-lg font-semibold truncate max-w-[400px] md:max-w-[600px]">
						{project.title}
					</h1>
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal uppercase">
							{project.type.replace("_", " ")}
						</Badge>
					</div>
				</div>
			</div>

			<div className="flex items-center gap-2">
				<Button variant="outline" size="sm" className="hidden md:flex">
					<Share2 className="mr-2 h-4 w-4" /> Share
				</Button>
				<Button size="sm">
					<Save className="mr-2 h-4 w-4" /> Save
				</Button>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon">
							<MoreVertical className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem>Export as PDF</DropdownMenuItem>
						<DropdownMenuItem className="text-red-500">Delete Project</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}

