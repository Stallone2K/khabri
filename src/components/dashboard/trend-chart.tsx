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
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { CHART_COLORS } from "./trend-table";

const CustomTooltip = ({ active, payload, label }: any) => {
	if (active && payload && payload.length) {
		return (
			<div className="bg-background/95 border rounded-lg shadow-xl p-3 text-xs backdrop-blur-sm">
				<p className="font-bold mb-2 text-muted-foreground">{label}</p>
				<div className="space-y-1">
					{payload.map((entry: any, index: number) => {
						if (entry.value === 0) return null;
						return (
							<div key={index} className="flex items-center gap-2 min-w-[120px]">
								<div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.stroke }} />
								<span className="font-medium text-foreground">Rank #{entry.name.replace('trend_', '')}</span>
								<span className="ml-auto font-mono font-bold">{entry.value} Signals</span>
							</div>
						);
					})}
				</div>
			</div>
		);
	}
	return null;
};

// 1. ADD PROP FOR TRIGGER
export function TrendChart({ trigger = 0 }: { trigger?: number }) {
	const [data, setData] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [timeRange, setTimeRange] = useState("12");

	useEffect(() => {
		setLoading(true);
		fetch(`/api/trends/graph?hours=${timeRange}`)
			.then(res => res.json())
			.then(chartData => {
				setData(chartData);
				setLoading(false);
			})
			.catch(err => {
				console.error("Chart load failed", err);
				setLoading(false);
			});
	}, [timeRange, trigger]); // 2. LISTEN TO TRIGGER

	const keys = data.length > 0 ? Object.keys(data[0]).filter(k => k.startsWith('trend_')) : [];

	return (
		<Card className="col-span-1 md:col-span-2 lg:col-span-5 shadow-sm border-none">
			{/* ... Render code remains the same ... */}
			<CardHeader className="pb-2 flex flex-row items-start justify-between">
				<div className="space-y-1">
					<CardTitle className="text-lg">Narrative Activity</CardTitle>
				</div>
				<Select value={timeRange} onValueChange={setTimeRange}>
					<SelectTrigger className="w-[120px] h-8 text-xs">
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
							<Tooltip content={<CustomTooltip />} cursor={{ stroke: '#000', strokeWidth: 1, strokeDasharray: '4 4', opacity: 0.1 }} />
							{keys.map((key, index) => (
								<Line
									key={key}
									type="monotone"
									dataKey={key}
									stroke={CHART_COLORS[index % CHART_COLORS.length]}
									strokeWidth={2.5}
									dot={false}
									activeDot={{ r: 6, strokeWidth: 0 }}
									animationDuration={1000}
								/>
							))}
						</LineChart>
					</ResponsiveContainer>
				</div>
			</CardContent>
		</Card>
	);
}
