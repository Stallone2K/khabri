"use client";

import { useState, useEffect } from "react";
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer
} from "recharts";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { CHART_COLORS } from "./trend-table";

interface TrendMeta {
	rank: number;
	topic: string;
	key: string;
}

const CustomTooltip = ({ active, payload, label, trendMap }: any) => {
	if (active && payload && payload.length) {
		const nonZero = payload.filter((e: any) => e.value > 0);
		if (nonZero.length === 0) return null;

		return (
			<div className="bg-background/95 border rounded-lg shadow-xl p-3 text-xs backdrop-blur-sm max-w-[300px]">
				<p className="font-bold mb-2 text-muted-foreground">{label}</p>
				<div className="space-y-1">
					{nonZero.slice(0, 8).map((entry: any, index: number) => {
						const meta = trendMap?.[entry.dataKey];
						return (
							<div key={index} className="flex items-center gap-2">
								<div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.stroke }} />
								<span className="text-foreground truncate">
									{meta?.topic || `Rank #${entry.dataKey.replace('trend_', '')}`}
								</span>
								<span className="ml-auto font-mono font-bold shrink-0">{entry.value}</span>
							</div>
						);
					})}
					{nonZero.length > 8 && (
						<p className="text-muted-foreground text-[10px]">+{nonZero.length - 8} more</p>
					)}
				</div>
			</div>
		);
	}
	return null;
};

interface TrendChartProps {
	trigger?: number;
	selectedRank?: number | null;
	onSelectRank?: (rank: number | null) => void;
	regionFilter?: string;
}

export function TrendChart({ trigger = 0, selectedRank = null, onSelectRank, regionFilter = "ALL" }: TrendChartProps) {
	const [data, setData] = useState<any[]>([]);
	const [trendsMeta, setTrendsMeta] = useState<TrendMeta[]>([]);
	const [loading, setLoading] = useState(true);
	const [timeRange, setTimeRange] = useState("12");

	useEffect(() => {
		setLoading(true);
		const regionParam = regionFilter && regionFilter !== "ALL" ? `&region=${regionFilter}` : "";
		fetch(`/api/trends/graph?hours=${timeRange}${regionParam}`)
			.then(res => res.json())
			.then(response => {
				setData(response.chartData || []);
				setTrendsMeta(response.trends || []);
				setLoading(false);
			})
			.catch(err => {
				console.error("Chart load failed", err);
				setLoading(false);
			});
	}, [timeRange, trigger, regionFilter]);

	// Build a lookup map: key -> TrendMeta
	const trendMap: Record<string, TrendMeta> = {};
	trendsMeta.forEach(t => { trendMap[t.key] = t; });

	const keys = data.length > 0
		? Object.keys(data[0]).filter(k => k.startsWith('trend_'))
		: [];

	return (
		<Card className="col-span-1 md:col-span-2 lg:col-span-5 shadow-sm border-none">
			<CardHeader className="pb-2 flex flex-row items-start justify-between">
				<div className="space-y-1">
					<CardTitle className="text-lg">Narrative Activity</CardTitle>
				</div>
				<Select value={timeRange} onValueChange={setTimeRange}>
					<SelectTrigger className="w-[140px] h-8 text-xs">
						<SelectValue placeholder="Time Range" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="3">Last 3 Hours</SelectItem>
						<SelectItem value="6">Last 6 Hours</SelectItem>
						<SelectItem value="12">Last 12 Hours</SelectItem>
						<SelectItem value="24">Last 24 Hours</SelectItem>
					</SelectContent>
				</Select>
			</CardHeader>

			<CardContent className="pl-0 pb-0">
				<div className="h-[280px] w-full relative">
					{loading && (
						<div className="absolute inset-0 z-10 bg-background/50 flex items-center justify-center backdrop-blur-[1px]">
							<Loader2 className="h-6 w-6 animate-spin text-primary" />
						</div>
					)}
					<ResponsiveContainer width="100%" height="100%">
						<LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
							<CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
							<XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#aaa' }} minTickGap={30} dy={10} />
							<YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#aaa' }} width={30} />
							<Tooltip
								content={<CustomTooltip trendMap={trendMap} />}
								cursor={{ stroke: '#000', strokeWidth: 1, strokeDasharray: '4 4', opacity: 0.1 }}
							/>
							{keys.map((key, index) => {
								const rank = parseInt(key.replace('trend_', ''));
								const isSelected = selectedRank === rank;
								const hasSelection = selectedRank !== null;

								return (
									<Line
										key={key}
										type="monotone"
										dataKey={key}
										stroke={CHART_COLORS[index % CHART_COLORS.length]}
										strokeWidth={isSelected ? 3 : hasSelection ? 1 : 1.5}
										strokeOpacity={isSelected ? 1 : hasSelection ? 0.15 : 0.6}
										dot={false}
										activeDot={isSelected || !hasSelection ? { r: 5, strokeWidth: 0 } : false}
										animationDuration={800}
									/>
								);
							})}
						</LineChart>
					</ResponsiveContainer>
				</div>

				{/* Legend: clickable trend names */}
				{trendsMeta.length > 0 && (
					<div className="flex flex-wrap gap-x-4 gap-y-1 px-6 py-3 border-t">
						{trendsMeta.slice(0, 10).map((t, i) => {
							const isSelected = selectedRank === t.rank;
							const hasSelection = selectedRank !== null;
							return (
								<button
									key={`legend-${i}`}
									onClick={() => onSelectRank?.(isSelected ? null : t.rank)}
									className={`flex items-center gap-1.5 text-[11px] transition-opacity ${
										isSelected ? "opacity-100" : hasSelection ? "opacity-30" : "opacity-70"
									} hover:opacity-100`}
								>
									<div
										className="h-2 w-2 rounded-full shrink-0"
										style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
									/>
									<span className="truncate max-w-[140px]">
										#{t.rank} {t.topic}
									</span>
								</button>
							);
						})}
						{trendsMeta.length > 10 && (
							<span className="text-[11px] text-muted-foreground">
								+{trendsMeta.length - 10} more
							</span>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
