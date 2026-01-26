'use client';

import { useState, useEffect } from 'react';
import { TrendTable } from '@/components/dashboard/trend-table';
import { TrendChart } from '@/components/dashboard/trend-chart';
import { TrendTicker } from '@/components/dashboard/trend-ticker';
import {
	Radar,
	TriangleAlert,
	RotateCw,
	Thermometer,
	ChevronsUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// --- HELPER: COOL TIME FORMATTER ---
function formatCoolTimeAgo(dateString: string | null) {
	if (!dateString) return "Idle";

	const now = new Date();
	const past = new Date(dateString);
	const diffMs = now.getTime() - past.getTime();
	const diffSec = Math.floor(diffMs / 1000);
	const diffMin = Math.floor(diffSec / 60);
	const diffHr = Math.floor(diffMin / 60);
	const diffDays = Math.floor(diffHr / 24);

	if (diffSec < 60) return "< 1 Min Ago";
	if (diffMin < 60) return `${diffMin} Min Ago`;
	if (diffHr < 24) return `${diffHr} Hr Ago`;
	return `${diffDays} Days Ago`;
}

// --- STATS COMPONENT ---
function DashboardStats({ trigger }: { trigger: number }) {
	const [stats, setStats] = useState<any>({
		signalsProcessed: 0,
		criticalTrends: 0,
		lastUpdate: null,
		activeProjects: 0,
		avgScore: 0,
		trendVelocity: 0
	});
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetch('/api/dashboard/stats')
			.then(res => res.json())
			.then(data => {
				setStats(data);
				setLoading(false);
			})
			.catch(err => console.error(err));
	}, [trigger]);

	if (loading) return <div className="h-28 bg-muted animate-pulse rounded-xl col-span-5"></div>;

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-base font-bold">Scanned</CardTitle>
					<Radar className="h-6 w-6 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold">{stats.signalsProcessed}</div>
					<p className="text-xs text-muted-foreground mt-1">Total Inputs (24H)</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-base font-bold">Critical Trends</CardTitle>
					<TriangleAlert className={`h-6 w-6 ${stats.criticalTrends > 0 ? "text-red-500" : "text-muted-foreground"}`} />
				</CardHeader>
				<CardContent>
					<div className={`text-2xl font-bold ${stats.criticalTrends > 0 ? "text-red-600" : ""}`}>
						{stats.criticalTrends}
					</div>
					<p className="text-xs text-muted-foreground mt-1">Score {'>'} 80</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-base font-bold">Market Temp</CardTitle>
					<Thermometer className={`h-6 w-6 ${stats.avgScore > 75 ? "text-orange-500" : "text-blue-500"}`} />
				</CardHeader>
				<CardContent>
					<div className={`text-2xl font-bold ${stats.avgScore > 75 ? "text-orange-600" : "text-blue-600"}`}>
						{stats.avgScore}°
					</div>
					<p className="text-xs text-muted-foreground mt-1">{stats.avgScore > 75 ? "High Intensity" : "Normal Levels"}</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-base font-bold">Velocity</CardTitle>
					<ChevronsUp className="h-6 w-6 text-purple-500" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold">{stats.trendVelocity}</div>
					<p className="text-xs text-muted-foreground mt-1">Signals / Hour</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-base font-bold">Engine Status</CardTitle>
					<RotateCw className="h-6 w-6 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					{/* UPDATED: Uses the new 'Cool' formatter */}
					<div className="text-xl font-bold truncate">
						{formatCoolTimeAgo(stats.lastUpdate)}
					</div>
					<p className="text-xs text-muted-foreground mt-1">Last Pipeline Run</p>
				</CardContent>
			</Card>
		</div>
	);
}

// --- MAIN PAGE ---
export default function DashboardPage() {
	const [refreshTrigger, setRefreshTrigger] = useState(0);

	const handleDataUpdate = () => {
		setRefreshTrigger(prev => prev + 1);
	};

	return (
		<div className="flex flex-col min-h-screen w-full max-w-[100vw] overflow-x-hidden">

			<div className="w-full">
				<TrendTicker />
			</div>

			<div className="flex flex-col gap-8 p-4 md:p-8 w-full max-w-7xl mx-auto">
				<div className="flex items-center justify-between mt-6">
					<div>
						<h1 className="text-3xl font-bold tracking-tight">Overview</h1>
					</div>
				</div>

				<DashboardStats trigger={refreshTrigger} />

				<TrendChart trigger={refreshTrigger} />

				<TrendTable onUpdate={handleDataUpdate} />
			</div>
		</div>
	);
}

