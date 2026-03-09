"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

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
	RotateCw,
	MoreHorizontal,
	ExternalLink,
	Loader2,
	Play,
	Copy,
	FileText,
	ChevronLeft,
	ChevronRight,
	ChevronDown,
	Earth,
	Antenna,
	Layers
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "@/components/ui/select";

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
	category?: string;
	originalUrl?: string;
	createdAt: string;
}

interface Pagination {
	page: number;
	pageSize: number;
	totalCount: number;
	totalPages: number;
}

// --- CATEGORY STYLING ---
const CATEGORY_STYLES: Record<string, { color: string; label: string }> = {
	POLITICS: { color: "text-purple-400 border-purple-400/40", label: "Politics" },
	GEOPOLITICS: { color: "text-red-400 border-red-400/40", label: "Geopolitics" },
	TECH: { color: "text-cyan-400 border-cyan-400/40", label: "Tech" },
	FINANCE: { color: "text-green-400 border-green-400/40", label: "Finance" },
	CRYPTO: { color: "text-amber-400 border-amber-400/40", label: "Crypto" },
	SCIENCE: { color: "text-teal-400 border-teal-400/40", label: "Science" },
	MILITARY: { color: "text-red-500 border-red-500/40", label: "Military" },
	CLIMATE: { color: "text-emerald-400 border-emerald-400/40", label: "Climate" },
	HEALTH: { color: "text-pink-400 border-pink-400/40", label: "Health" },
	SPORTS: { color: "text-orange-400 border-orange-400/40", label: "Sports" },
	ENTERTAINMENT: { color: "text-violet-400 border-violet-400/40", label: "Entertainment" },
	BUSINESS: { color: "text-blue-400 border-blue-400/40", label: "Business" },
	SOCIETY: { color: "text-yellow-400 border-yellow-400/40", label: "Society" },
};

const getCategoryStyle = (category?: string) => {
	if (!category) return { color: "text-zinc-500 border-zinc-500/30", label: "General" };
	return CATEGORY_STYLES[category] || { color: "text-zinc-500 border-zinc-500/30", label: category };
};

interface TrendTableProps {
	onUpdate?: () => void;
	selectedRank?: number | null;
	onSelectRank?: (rank: number | null) => void;
	regionFilter?: string;
	onRegionChange?: (value: string) => void;
	countryName?: string | null;
}

export function TrendTable({ onUpdate, selectedRank = null, onSelectRank, regionFilter = "ALL", onRegionChange, countryName }: TrendTableProps) {
	const [trends, setTrends] = useState<Trend[]>([]);
	const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 30, totalCount: 0, totalPages: 0 });
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [sortKey, setSortKey] = useState<"rank" | "score" | "category" | "createdAt">("rank");
	const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
	const [activeSpikes, setActiveSpikes] = useState<Map<string, { severity: string; zScore: number; type: string }>>(new Map());



	const fetchTrends = useCallback(async (page: number = 1) => {
		try {
			const regionParam = regionFilter && regionFilter !== "ALL" ? `&region=${regionFilter}` : "";
			const res = await fetch(`/api/trends/list?page=${page}&pageSize=30${regionParam}`);
			if (res.ok) {
				const data = await res.json();
				setTrends(data.trends);
				setPagination(data.pagination);
			}
		} catch (e) {
			console.error(e);
		} finally {
			setLoading(false);
		}
	}, [regionFilter]);

	const runPipeline = async () => {
		setRefreshing(true);
		toast.info("Scanning 170+ Feeds\u2026", { description: "This may take 15-30 seconds." });
		try {
			const res = await fetch("/api/ingest", { method: "POST" });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Failed");

			toast.success("Pipeline Complete", {
				description: `Scanned ${data.feedsScanned} feeds. Found ${data.trendsGenerated} trends, ingested ${data.signalsIngested} new signals.`
			});
			fetchTrends(1); // go back to page 1 to see latest
			if (onUpdate) onUpdate();
		} catch (e: any) {
			toast.error("Pipeline Failed", { description: e.message });
		} finally {
			setRefreshing(false);
		}
	};

	const handleCreateProject = async (topic: string, url?: string) => {
		const toastId = toast.loading("Creating Tracked Trend\u2026");
		try {
			const res = await fetch("/api/projects", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: topic,
					type: "TRACKED_TREND",
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

			toast.success("Trend Tracked", { id: toastId });
			window.dispatchEvent(new Event("project-created"));
		} catch (e: any) {
			toast.error("Failed To Track Trend", { id: toastId, description: e.message });
		}
	};

	useEffect(() => {
		fetchTrends();
		// Fetch active anomalies (keywords + entities) for badge display
		fetch("/api/intelligence/anomalies?active=true&limit=100")
			.then((res) => res.json())
			.then((data) => {
				const map = new Map<string, { severity: string; zScore: number; type: string }>();
				for (const a of data.anomalies || []) {
					const key = a.type === "ENTITY_SURGE" ? a.key.split("::")[0].toLowerCase() : a.key.toLowerCase();
					const existing = map.get(key);
					// Keep highest severity per key
					if (!existing || a.zScore > existing.zScore) {
						map.set(key, { severity: a.severity, zScore: a.zScore, type: a.type });
					}
				}
				setActiveSpikes(map);
			})
			.catch(() => {});
	}, [fetchTrends]);

	const toggleSort = (key: typeof sortKey) => {
		if (sortKey === key) {
			setSortDir(sortDir === "asc" ? "desc" : "asc");
		} else {
			setSortKey(key);
			setSortDir(key === "score" ? "desc" : "asc");
		}
	};

	const sortedTrends = useMemo(() => {
		const sorted = [...trends];
		sorted.sort((a, b) => {
			let cmp = 0;
			switch (sortKey) {
				case "rank": cmp = a.rank - b.rank; break;
				case "score": cmp = a.score - b.score; break;
				case "category": cmp = (a.category || "").localeCompare(b.category || ""); break;
				case "createdAt": cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
			}
			return sortDir === "asc" ? cmp : -cmp;
		});
		return sorted;
	}, [trends, sortKey, sortDir]);

	const SortIcon = ({ col }: { col: typeof sortKey }) => {
		if (sortKey !== col) return <ChevronDown className="h-3 w-3 ml-1 opacity-30" />;
		return <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${sortDir === "asc" ? "rotate-180" : ""}`} />;
	};

	const goToPage = (page: number) => {
		setLoading(true);
		fetchTrends(page);
	};

	return (
		<Card className="col-span-1 shadow-sm">
			<CardHeader className="flex flex-row items-center justify-between gap-3 pb-4 px-4 md:px-6">
				<CardTitle className="text-xl md:text-3xl font-extrabold">Trends</CardTitle>
				<div className="flex items-center gap-2">
					<Select value={regionFilter} onValueChange={(v) => onRegionChange?.(v)}>
						<SelectTrigger className="h-8 text-xs w-auto min-w-0">
							<SelectValue placeholder="Region" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="ALL">
								<span className="flex items-center gap-2">
									<Layers className="h-3.5 w-3.5" />
									All Trends
								</span>
							</SelectItem>
							<SelectItem value="DOMESTIC" disabled={!countryName}>
								<span className="flex items-center gap-2">
									<Antenna className="h-3.5 w-3.5" />
									{countryName ? `Domestic (${countryName})` : "Domestic"}
								</span>
							</SelectItem>
							<SelectItem value="INTERNATIONAL">
								<span className="flex items-center gap-2">
									<Earth className="h-3.5 w-3.5" />
									International
								</span>
							</SelectItem>
						</SelectContent>
					</Select>
					<Button
						variant="outline"
						size="icon"
						onClick={runPipeline}
						disabled={refreshing}
						className="h-8 w-8 shrink-0"
					>
						{refreshing ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<RotateCw className="h-4 w-4" />
						)}
					</Button>
				</div>
			</CardHeader>

			<CardContent className="p-0">
				{loading ? (
					<div className="flex items-center justify-center p-8 text-muted-foreground">
						<Loader2 className="h-6 w-6 animate-spin" />
					</div>
				) : trends.length === 0 ? (
					<div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
						<p className="text-muted-foreground">No trends detected yet.</p>
						<Button onClick={runPipeline} variant="secondary">
							<Play className="mr-2 h-4 w-4" /> Scan Feeds
						</Button>
					</div>
				) : (
					<>
						<div className="px-2 md:px-4 overflow-x-auto">
					<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-[40px] md:w-[50px] text-center hidden sm:table-cell">Graph</TableHead>
									<TableHead className="w-[50px] md:w-[60px] text-center cursor-pointer select-none" onClick={() => toggleSort("rank")}>
										<span className="inline-flex items-center justify-center">Rank <SortIcon col="rank" /></span>
									</TableHead>
									<TableHead className="w-[60px] md:w-[80px] text-center cursor-pointer select-none" onClick={() => toggleSort("score")}>
										<span className="inline-flex items-center justify-center">Score <SortIcon col="score" /></span>
									</TableHead>
									<TableHead className="min-w-[150px] md:min-w-[250px]">Topic</TableHead>
									<TableHead className="w-[140px] cursor-pointer select-none hidden md:table-cell" onClick={() => toggleSort("category")}>
										<span className="inline-flex items-center">Category <SortIcon col="category" /></span>
									</TableHead>
									<TableHead className="w-[140px] text-right cursor-pointer select-none hidden lg:table-cell" onClick={() => toggleSort("createdAt")}>
										<span className="inline-flex items-center justify-end w-full">Detected <SortIcon col="createdAt" /></span>
									</TableHead>
									<TableHead className="w-[40px] md:w-[50px]"></TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{sortedTrends.map((trend, index) => {
									const cat = getCategoryStyle(trend.category);
									return (
										<TableRow
										key={trend.id}
										className={`group cursor-pointer transition-opacity ${
											selectedRank === trend.rank ? "bg-muted/60" : selectedRank !== null ? "opacity-50 hover:opacity-80" : "hover:bg-muted/50"
										}`}
										onClick={() => onSelectRank?.(selectedRank === trend.rank ? null : trend.rank)}
									>
											<TableCell className="text-center hidden sm:table-cell">
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

											<TableCell className="font-medium text-xs md:text-sm">
												<div className="flex items-center gap-2">
													<span className="line-clamp-2 md:line-clamp-1">{trend.topic}</span>
													{(() => {
														const spike = getTopicSpike(trend.topic, activeSpikes);
														if (!spike) return null;
														const badgeColor =
															spike.severity === "CRITICAL" ? "bg-red-500/15 text-red-500 border-red-500/30" :
															spike.severity === "HIGH" ? "bg-orange-500/15 text-orange-500 border-orange-500/30" :
															"bg-yellow-500/15 text-yellow-500 border-yellow-500/30";
														return (
															<TooltipProvider>
																<Tooltip>
																	<TooltipTrigger asChild>
																		<span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${badgeColor}`}>
																			<span className={`h-1.5 w-1.5 rounded-full ${
																				spike.severity === "CRITICAL" ? "bg-red-500 animate-pulse" :
																				spike.severity === "HIGH" ? "bg-orange-500" : "bg-yellow-500"
																			}`} />
																			{spike.severity}
																		</span>
																	</TooltipTrigger>
																	<TooltipContent>
																		<div className="text-xs space-y-0.5">
																			<div className="text-muted-foreground">
																				{spike.type === "KEYWORD_SPIKE" ? "Keyword Spike" :
																				 spike.type === "ENTITY_SURGE" ? "Entity Surge" :
																				 spike.type === "GEO_CONCENTRATION" ? "Geo Concentration" : spike.type}
																				{" "}(z={spike.zScore.toFixed(1)})
																			</div>
																		</div>
																	</TooltipContent>
																</Tooltip>
															</TooltipProvider>
														);
													})()}
												</div>
											</TableCell>

											<TableCell className="hidden md:table-cell">
												<Badge
													variant="outline"
													className={`
														rounded-md font-medium border bg-black hover:bg-black/90 transition-colors text-xs
														${cat.color}
													`}
												>
													{cat.label}
												</Badge>
											</TableCell>

											<TableCell className="text-right text-muted-foreground text-xs font-mono hidden lg:table-cell">
												{formatDetectedTime(trend.createdAt)}
											</TableCell>

											<TableCell>
												<DropdownMenu>
													<DropdownMenuTrigger asChild>
														<Button variant="ghost" className="h-8 w-8 p-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
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

														<DropdownMenuItem
															onSelect={(e) => {
																e.preventDefault();
																handleCreateProject(trend.topic, trend.originalUrl);
															}}
														>
															<FileText className="mr-2 h-4 w-4" /> Track Trend
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
					</div>

						{/* PAGINATION */}
						{pagination.totalPages > 1 && (
							<div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 md:px-6 py-3 md:py-4 border-t">
								<p className="text-xs text-muted-foreground">
									{pagination.totalCount} trends &middot; Page {pagination.page} of {pagination.totalPages}
								</p>
								<div className="flex items-center gap-0.5">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => goToPage(pagination.page - 1)}
										disabled={pagination.page <= 1}
										className="h-8 px-2 text-xs text-muted-foreground gap-1"
									>
										<ChevronLeft className="h-3.5 w-3.5" />
										Previous
									</Button>

									{getPageNumbers(pagination.page, pagination.totalPages).map((p, i) => (
										p === -1 ? (
											<span key={`ellipsis-${i}`} className="px-0.5 text-xs text-muted-foreground">...</span>
										) : (
											<Button
												key={p}
												variant={p === pagination.page ? "outline" : "ghost"}
												size="sm"
												onClick={() => goToPage(p)}
												className={`h-7 w-7 p-0 text-xs ${p === pagination.page ? "border rounded-md" : "text-muted-foreground"}`}
											>
												{p}
											</Button>
										)
									))}

									<Button
										variant="ghost"
										size="sm"
										onClick={() => goToPage(pagination.page + 1)}
										disabled={pagination.page >= pagination.totalPages}
										className="h-8 px-2 text-xs text-muted-foreground gap-1"
									>
										Next
										<ChevronRight className="h-3.5 w-3.5" />
									</Button>
								</div>
							</div>
						)}
					</>
				)}
			</CardContent>
		</Card>
	);
}

// --- HELPERS ---

/** Show relative time for today, date for older */
function formatDetectedTime(dateStr: string): string {
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffHrs = diffMs / (1000 * 60 * 60);

	if (diffHrs < 24) {
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
	if (diffHrs < 48) {
		return "Yesterday " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
	return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
		" " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Check if a trend topic has any spiking keywords */
const SPIKE_STOP_WORDS = new Set(["the", "and", "for", "that", "this", "with", "from", "its", "has", "have", "are", "was", "were", "will", "been", "not", "but", "new", "over", "after", "says", "could", "into", "than", "may", "how", "what", "who", "why"]);

function getTopicSpike(topic: string, spikeMap: Map<string, { severity: string; zScore: number; type: string }>): { severity: string; zScore: number; type: string } | null {
	const words = topic.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !SPIKE_STOP_WORDS.has(w));
	for (const word of words) {
		const spike = spikeMap.get(word);
		if (spike) return spike;
	}
	return null;
}

/** Generate page numbers with ellipsis (-1 = ellipsis marker) */
function getPageNumbers(current: number, total: number): number[] {
	if (total <= 3) return Array.from({ length: total }, (_, i) => i + 1);

	const pages: number[] = [];

	// Show 3 pages around current
	const start = Math.max(1, current - 1);
	const end = Math.min(total, start + 2);
	const adjustedStart = Math.max(1, end - 2);

	for (let i = adjustedStart; i <= end; i++) pages.push(i);

	// Add ellipsis if there are more pages after
	if (end < total) pages.push(-1);

	return pages;
}
