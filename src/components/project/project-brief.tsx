"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ExternalLink, ArrowRight, Link, Tv, Target, Bot } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function ProjectBrief({ project }: { project: any }) {
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const [generating, setGenerating] = useState(false);

	// Local State for Form Inputs
	const [title, setTitle] = useState(project.title || "");
	const [url, setUrl] = useState(project.brief?.originalUrl || "");
	const [summary, setSummary] = useState(project.brief?.summary || ""); // <--- NEW STATE
	const [audience, setAudience] = useState(project.brief?.audience || "");
	const [notes, setNotes] = useState(project.brief?.notes || "");

	// Mock function to simulate AI generation (You can connect this to an API later)
	// ... inside ProjectBrief component ...

	const handleGenerateSummary = async () => {
		if (!title) {
			toast.error("Please enter a topic first");
			return;
		}
		setGenerating(true);
		// toast.info("Consulting AI..."); // Optional

		try {
			const res = await fetch('/api/engine/summary', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: title,
					context: notes // Sending notes helps AI understand context
				})
			});

			if (!res.ok) throw new Error("AI failed to respond");

			const data = await res.json();
			setSummary(data.summary);
			toast.success("Summary Generated");

		} catch (error) {
			toast.error("Failed to generate summary");
		} finally {
			setGenerating(false);
		}
	};

	const handleSaveAndContinue = async () => {
		setLoading(true);
		try {
			const res = await fetch(`/api/projects/${project.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: title,
					brief: {
						...project.brief,
						originalUrl: url,
						summary: summary, // <--- SAVING SUMMARY
						audience: audience,
						notes: notes
					}
				})
			});

			if (!res.ok) throw new Error("Failed to save");

			toast.success("Manifest Saved");
			router.refresh();
		} catch (error) {
			toast.error("Something went wrong");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="max-w-5xl mx-auto space-y-8 pb-10">

			{/* SECTION 1: CORE IDENTITY */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
				<div className="lg:col-span-2 space-y-6">

					{/* 1.1: Project Identity Card */}
					<Card className="">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-lg">
								<Tv className="h-5 w-5 text-red-600" /> Project Identity
							</CardTitle>
							<CardDescription>Define The Core Topic. This Is What The AI Will Look For.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">

							{/* TOPIC INPUT */}
							<div className="space-y-2">
								<Label htmlFor="topic">Project Topic / Keyword</Label>
								<Input
									id="topic"
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									placeholder="e.g. DeepSeek vs ChatGPT Performance Analysis"
									className="font-semibold text-lg h-12 bg-background"
								/>
							</div>

							{/* NEW: SUMMARY LETTERBOX */}
							<div className="space-y-2 relative">
								<div className="flex items-center justify-between">
									<Label htmlFor="summary" className="flex items-center gap-2">
										Executive Summary
									</Label>

									{/* Generator Button (Only shows if summary is empty) */}
									{(!summary && title) && (
										<Button
											variant="ghost"
											size="sm"
											onClick={handleGenerateSummary}
											disabled={generating}
											className="h-6 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
										>
											{generating ? "Generating..." : "Auto-Generate Summary"}
										</Button>
									)}
								</div>

								<Textarea
									id="summary"
									value={summary}
									onChange={(e) => setSummary(e.target.value)}
									placeholder={generating ? "AI is writing..." : "A Short 50-100 Word Summary Of The Topic. If This Is A Trend, It Will Be Pre-Filled. If Not, Click Generate."}
									className="min-h-[100px] resize-none bg-background text-sm leading-relaxed"
									disabled={generating}
								/>
							</div>

						</CardContent>
					</Card>

					{/* 1.2: Research Context Card */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-lg">
								<Link className="h-5 w-5 text-blue-500" /> Primary Source (Optional)
							</CardTitle>
							<CardDescription>
								Add A URL To Ground The Research. The AI Will Prioritize Reading This First.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex gap-2">
								<div className="relative flex-1">
									<div className="absolute left-3 top-3 h-4 w-4 text-muted-foreground">
										<Link className="h-4 w-4" />
									</div>
									<Input
										value={url}
										onChange={(e) => setUrl(e.target.value)}
										placeholder="https://techcrunch.com/..."
										className="pl-9"
									/>
								</div>
								{url && (
									<Button variant="outline" size="icon" asChild>
										<a href={url} target="_blank" rel="noopener noreferrer">
											<ExternalLink className="h-4 w-4" />
										</a>
									</Button>
								)}
							</div>
						</CardContent>
					</Card>
				</div>

				{/* SECTION 2: SIDEBAR INSTRUCTIONS */}
				<div className="lg:col-span-1 space-y-6">
					<Card className="h-full bg-muted/20 border-dashed">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-base">
								<Target className="h-4 w-4 text-orange-500" /> Directives
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="space-y-2">
								<Label className="text-xs font-semibold uppercase text-muted-foreground">Target Audience</Label>
								<Input
									value={audience}
									onChange={(e) => setAudience(e.target.value)}
									placeholder="e.g. Investors, Gen Z..."
									className="bg-background"
								/>
							</div>
							<div className="space-y-2">
								<Label className="text-xs font-semibold uppercase text-muted-foreground">Context / Brain Dump</Label>
								<Textarea
									value={notes}
									onChange={(e) => setNotes(e.target.value)}
									placeholder="Paste Random Notes, Specific Questions To Answer, Or Constraints..."
									className="bg-background min-h-[320px] resize-none"
								/>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>

			{/* SECTION 3: ACTION AREA */}
			<div className="flex items-center justify-end gap-4 py-4 border-t">
				<p className="text-sm text-muted-foreground">
					Ready to gather intelligence?
				</p>
				<Button size="lg" onClick={handleSaveAndContinue} disabled={loading}>
					{loading ? "Saving..." : "Save Manifest & Start Research"}
					<ArrowRight className="ml-2 h-4 w-4" />
				</Button>
			</div>

		</div>
	);
}

