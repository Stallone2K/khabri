"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plug, RefreshCcw, CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export function ProjectResearch({ project }: { project: any }) {
	const [dossier, setDossier] = useState(project.researchData || "");
	const [loading, setLoading] = useState(false);

	const startResearch = async () => {
		setLoading(true);
		toast.info("Agent is browsing the web... (This may take 30s)");

		try {
			const res = await fetch('/api/engine/research', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ projectId: project.id })
			});

			if (!res.ok) throw new Error("Research agent failed");

			const data = await res.json();
			setDossier(data.dossier);
			toast.success("Research Complete");

		} catch (e: any) {
			toast.error(`Error: ${e.message}`);
		} finally {
			setLoading(false);
		}
	};

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center h-[calc(100vh-12rem)] space-y-6 border border-dashed rounded-lg bg-muted/5">
				<div className="relative">
					<div className="absolute inset-0 bg-primary/20 rounded-full animate-ping"></div>
					<Loader2 className="h-12 w-12 text-primary animate-spin relative z-10" />
				</div>
				<div className="text-center space-y-2">
					<h3 className="text-lg font-medium animate-pulse">Deep Research Agent is Active...</h3>
					<p className="text-sm text-muted-foreground">
						Analyzing Context • Cross-Referencing Sources • Building Dossier
					</p>
				</div>
			</div>
		);
	}

	if (dossier) {
		return (
			<div className="h-[calc(100vh-10rem)] flex flex-col space-y-4 max-w-5xl mx-auto w-full pb-4">
				{/* Header */}
				<div className="flex items-center justify-between p-4 border rounded-lg bg-background shadow-sm shrink-0">
					<div className="flex items-center gap-2">
						<CheckCircle2 className="h-5 w-5 text-green-500" />
						<span className="font-semibold">Research Dossier Ready</span>
					</div>
					<div className="flex gap-2">
						<Button variant="outline" size="sm" onClick={() => {
							navigator.clipboard.writeText(dossier);
							toast.success("Copied to clipboard");
						}}>
							<Copy className="mr-2 h-3 w-3" /> Copy
						</Button>
						<Button variant="secondary" size="sm" onClick={startResearch}>
							<RefreshCcw className="mr-2 h-3 w-3" /> Re-Run
						</Button>
					</div>
				</div>

				{/* SCROLLABLE MARKDOWN VIEWER */}
				{/* 👇 FIXED: Added h-full and overflow-hidden to parent */}
				<Card className="flex-1 overflow-hidden border-none shadow-none bg-transparent flex flex-col">
					{/* 👇 FIXED: Added flex-1, overflow-y-auto to scroll content */}
					<CardContent className="flex-1 overflow-y-auto p-6 bg-card border rounded-lg prose prose-sm dark:prose-invert max-w-none">
						<ReactMarkdown>{dossier}</ReactMarkdown>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center justify-center h-[calc(100vh-12rem)] text-muted-foreground space-y-6 p-8 border border-dashed rounded-lg bg-muted/10">
			<div className="h-16 w-16 flex items-center justify-center bg-primary/10 rounded-full">
				<Plug className="h-8 w-8 text-primary" />
			</div>
			<div className="text-center space-y-2 max-w-md">
				<h3 className="text-xl font-semibold text-foreground">Deep Research Agent</h3>
				<p className="text-sm">
					This AI Agent will read the source URL, browse the web for related facts, and build a Master Dossier for: <br />
					<span className="font-medium text-primary block mt-2">"{project.title}"</span>
				</p>
			</div>
			<Button onClick={startResearch} size="lg">Start Research</Button>
		</div>
	);
}
