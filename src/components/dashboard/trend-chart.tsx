
'use client';

import { useState, useEffect } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { keywordColors } from './top-keywords-card';

type ChartData = {
	keywords: string[];
	data: any[];
};

export const TrendChart = () => {
	const [chartData, setChartData] = useState<ChartData | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const fetchChartData = async () => {
			try {
				const res = await fetch('/api/trends/graph');
				if (!res.ok) throw new Error('Failed to fetch chart data');
				const data = await res.json();
				setChartData(data);
			} catch (error) {
				console.error(error);
			} finally {
				setIsLoading(false);
			}
		};
		fetchChartData();
	}, []);

	if (isLoading) {
		return (
			<Card className="col-span-4">
				<CardHeader><CardTitle>Trend Graph</CardTitle></CardHeader>
				<CardContent className="pl-2">
					<div className="h-[350px] w-full bg-muted rounded-lg flex items-center justify-center">
						<Loader2 className="h-8 w-8 animate-spin" />
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!chartData || chartData.data.length === 0) {
		return (
			<Card className="col-span-4">
				<CardHeader><CardTitle>Trend Graph</CardTitle></CardHeader>
				<CardContent className="pl-2">
					<div className="h-[350px] w-full bg-muted rounded-lg flex items-center justify-center">
						<p className="text-muted-foreground">Not enough trend data to display a chart yet.</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="col-span-4">
			<CardHeader><CardTitle>Trend Graph</CardTitle></CardHeader>
			<CardContent className="pl-2">
				<ResponsiveContainer width="100%" height={350}>
					<AreaChart data={chartData.data}>
						<defs>
							{chartData.keywords.map((keyword, index) => (
								<linearGradient key={keyword} id={`color-${keyword}`} x1="0" y1="0" x2="0" y2="1">
									<stop offset="5%" stopColor={keywordColors[index % keywordColors.length]} stopOpacity={0.8} />
									<stop offset="95%" stopColor={keywordColors[index % keywordColors.length]} stopOpacity={0} />
								</linearGradient>
							))}
						</defs>
						<XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
						<YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
						<CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
						<Tooltip
							contentStyle={{
								backgroundColor: 'hsl(var(--background))',
								border: '1px solid hsl(var(--border))',
							}}
						/>
						{chartData.keywords.map((keyword, index) => (
							<Area
								key={keyword}
								type="monotone"
								dataKey={keyword}
								stroke={keywordColors[index % keywordColors.length]}
								fillOpacity={1}
								fill={`url(#color-${keyword})`}
							/>
						))}
					</AreaChart>
				</ResponsiveContainer>
			</CardContent>
		</Card>
	);
};
