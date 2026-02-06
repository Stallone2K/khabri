"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "@/components/ui/table";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	RefreshCw,
	MoreHorizontal,
	ExternalLink,
	Loader2,
	Play,
	Copy,
	FileText,
	Globe,
	Newspaper,
	Youtube,
	Twitter
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// --- PALETTE ---
export const CHART_COLORS = [
	"#14532d", "#166534", "#15803d",
	"#16a34a", "#4ade80", "#84cc16",
	"#a3e635", "#d9f99d", "#facc15",
	"#fde047", "#fef08a", "#fef9c3",
	"#fffbeb", "#ffffff", "#ffffff"
];

interface Trend {
	id: string;
	rank: number;
	topic: string;
	score: number;
	originalUrl?: string;
	createdAt: string;
}

const getSourceInfo = (url?: string) => {
	if (!url) return { label: "Unknown", color: "text-zinc-500 border-zinc-500/30", icon: Globe };
	const lower = url.toLowerCase();
	if (lower.includes("reddit.com")) return { label: "Reddit", color: "text-orange-400 border-orange-400/40", icon: Globe };
	if (lower.includes("twitter.com") || lower.includes("x.com")) return { label: "X / Twitter", color: "text-sky-400 border-sky-400/40", icon: Twitter };
	if (lower.includes("google.com") || lower.includes("news.google")) return { label: "Google News", color: "text-blue-400 border-blue-400/40", icon: Newspaper };
	if (lower.includes("youtube.com")) return { label: "YouTube", color: "text-red-400 border-red-400/40", icon: Youtube };
	return { label: "Web / RSS", color: "text-emerald-400 border-emerald-400/40", icon: Globe };
};

interface TrendTableProps {
	onUpdate?: () => void;
}

export function TrendTable({ onUpdate }: TrendTableProps) {
	const [trends, setTrends] = useState<Trend[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);

	const router = useRouter();

	const fetchTrends = async () => {
		try {
			const res = await fetch("/api/trends/list");
			if (res.ok) {
				const data = await res.json();
				setTrends(data);
			}
		} catch (e) {
			console.error(e);
		} finally {
			setLoading(false);
		}
	};

	const runPipeline = async () => {
		setRefreshing(true);
		toast.info("Scanning signals...", { description: "This may take 5-10 seconds." });
		try {
			const res = await fetch("/api/ingest", { method: "POST" });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Failed");

			toast.success("Pipeline Complete", { description: `Found ${data.trendsGenerated} new trends.` });
			fetchTrends();
			if (onUpdate) onUpdate();
		} catch (e: any) {
			toast.error("Pipeline Failed", { description: e.message });
		} finally {
			setRefreshing(false);
		}
	};

	// --- NEW: ROBUST CREATE PROJECT HANDLER ---
	const handleCreateProject = async (topic: string, url?: string) => {
		const toastId = toast.loading("Creating workspace...");
		try {
			const res = await fetch("/api/projects", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: topic,
					type: "BLOG_POST",
					brief: {
						initialTopic: topic,
						source: "Trend Dashboard",
						originalUrl: url,
						generatedAt: new Date().toISOString()
					}
				}),
			});
			const newProject = await res.json();

			if (!res.ok) throw new Error(newProject.error || "Failed to create project");

			toast.success("Project Created", { id: toastId });

			// --- CRITICAL FIX START ---
			// Shout to the Sidebar (Client Component) to update
			if (typeof window !== 'undefined') {
				window.dispatchEvent(new Event("project-created"));
			}
			// --- CRITICAL FIX END ---

			// Refresh Server Data
			router.refresh();

			// Redirect
			// router.push(`/dashboard/project/${newProject.id}`);

		} catch (e: any) {
			toast.error("Error", { id: toastId, description: e.message });
		}
	};

	useEffect(() => {
		fetchTrends();
	}, []);

	return (
		<Card className="col-span-1 shadow-sm">
			<CardHeader className="flex flex-row items-center justify-between pb-4">
				<div className="space-y-1">
					<CardTitle className="text-3xl font-extrabold">Trends</CardTitle>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={runPipeline}
					disabled={refreshing}
					className="h-8"
				>
					{refreshing ? (
						<Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
					) : (
						<RefreshCw className="mr-2 h-3.5 w-3.5" />
					)}
					Refresh
				</Button>
			</CardHeader>

			<CardContent className="p-0">
				{loading ? (
					<div className="flex items-center justify-center p-8 text-muted-foreground">
						<Loader2 className="h-6 w-6 animate-spin" />
					</div>
				) : trends.length === 0 ? (
					<div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
						<p className="text-muted-foreground">No trends active.</p>
						<Button onClick={runPipeline} variant="secondary">
							<Play className="mr-2 h-4 w-4" /> Start Ingest
						</Button>
					</div>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-[50px] text-center">Graph</TableHead>
								<TableHead className="w-[60px] text-center">Rank</TableHead>
								<TableHead className="w-[80px] text-center">Score</TableHead>
								<TableHead className="min-w-[250px]">Topic</TableHead>
								<TableHead className="w-[140px]">Source</TableHead>
								<TableHead className="w-[120px] text-right">Detected</TableHead>
								<TableHead className="w-[50px]"></TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{trends.map((trend, index) => {
								const source = getSourceInfo(trend.originalUrl);
								const SourceIcon = source.icon;
								return (
									<TableRow key={trend.id} className="group hover:bg-muted/50">
										<TableCell className="text-center">
											<div
												className="h-2 w-2 rounded-full mx-auto shadow-sm border border-black/10"
												style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
											/>
										</TableCell>

										<TableCell className="text-center font-medium text-muted-foreground">
											#{trend.rank}
										</TableCell>

										<TableCell className="text-center">
											<Badge
												variant="outline"
												className={`
													font-mono font-bold border rounded-lg px-3 py-0.5
													bg-black border-white/20 shadow-sm
													${trend.score >= 90 ? "text-red-500" :
														trend.score >= 80 ? "text-orange-400" :
															trend.score >= 60 ? "text-yellow-400" :
																"text-blue-400"
													}
												`}
											>
												{trend.score}
											</Badge>
										</TableCell>

										<TableCell className="font-medium text-sm">
											{trend.topic}
										</TableCell>

										<TableCell>
											<Badge
												variant="outline"
												className={`
													rounded-md font-medium border bg-black hover:bg-black/90 transition-colors
													${source.color}
												`}
											>
												<SourceIcon className="mr-1.5 h-3 w-3" strokeWidth={2.5} />
												{source.label}
											</Badge>
										</TableCell>

										<TableCell className="text-right text-muted-foreground text-xs font-mono">
											{new Date(trend.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
										</TableCell>

										<TableCell>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
														<span className="sr-only">Open menu</span>
														<MoreHorizontal className="h-4 w-4" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuLabel>Actions</DropdownMenuLabel>

													<DropdownMenuItem onSelect={() => navigator.clipboard.writeText(trend.topic)}>
														<Copy className="mr-2 h-4 w-4" /> Copy Topic
													</DropdownMenuItem>

													<DropdownMenuSeparator />

													{/* FIX: Use onSelect with e.preventDefault to keep menu logic alive if needed */}
													<DropdownMenuItem
														onSelect={(e) => {
															e.preventDefault(); // Prevents menu form closing too fast
															handleCreateProject(trend.topic, trend.originalUrl);
														}}
													>
														<FileText className="mr-2 h-4 w-4" /> Create Project
													</DropdownMenuItem>

													{trend.originalUrl && (
														<DropdownMenuItem asChild>
															<a href={trend.originalUrl} target="_blank" rel="noopener noreferrer">
																<ExternalLink className="mr-2 h-4 w-4" /> View Source
															</a>
														</DropdownMenuItem>
													)}
												</DropdownMenuContent>
											</DropdownMenu>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
