'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useUserCountry } from '@/hooks/use-user-country';
import { TrendTable } from '@/components/dashboard/trend-table';
import { TrendChart } from '@/components/dashboard/trend-chart';
import { TrendTicker } from '@/components/dashboard/trend-ticker';
import { useSidebarCollapsed } from '@/app/dashboard/layout';
import { PanelRight } from 'lucide-react';
import {
	Radar,
	TriangleAlert,
	RotateCw,
	Thermometer,
	ChevronsUp
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

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

// --- STAT CARD ---
function StatCard({ icon, label, value, subtitle, valueClass = "", span2 }: {
	icon: ReactNode;
	label: string;
	value: string | number;
	subtitle: string;
	valueClass?: string;
	span2?: boolean;
}) {
	const card = (
		<Card>
			<CardContent className="p-4">
				<div className="flex items-center justify-between mb-3">
					<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
					{icon}
				</div>
				<div className={`text-2xl font-bold truncate ${valueClass}`}>{value}</div>
				<p className="text-[11px] text-muted-foreground mt-1">{subtitle}</p>
			</CardContent>
		</Card>
	);

	if (span2) {
		return (
			<div className="col-span-2 lg:col-span-1 flex justify-center">
				<div className="w-[calc(50%-6px)]  lg:w-full">{card}</div>
			</div>
		);
	}

	return card;
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

	if (loading) return <div className="h-24 bg-muted animate-pulse rounded-xl"></div>;

	return (
		<div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
			<StatCard
				icon={<Radar className="h-4 w-4 text-muted-foreground" />}
				label="Scanned"
				value={stats.signalsProcessed}
				subtitle="Total Inputs (24H)"
			/>
			<StatCard
				icon={<TriangleAlert className={`h-4 w-4 ${stats.criticalTrends > 0 ? "text-red-500" : "text-muted-foreground"}`} />}
				label="Critical"
				value={stats.criticalTrends}
				subtitle="Score > 80"
				valueClass={stats.criticalTrends > 0 ? "text-red-600" : ""}
			/>
			<StatCard
				icon={<Thermometer className={`h-4 w-4 ${stats.avgScore > 75 ? "text-orange-500" : "text-blue-500"}`} />}
				label="Temp"
				value={`${stats.avgScore}°`}
				subtitle={stats.avgScore > 75 ? "High Intensity" : "Normal Levels"}
				valueClass={stats.avgScore > 75 ? "text-orange-600" : "text-blue-600"}
			/>
			<StatCard
				icon={<ChevronsUp className="h-4 w-4 text-purple-500" />}
				label="Velocity"
				value={stats.trendVelocity}
				subtitle="Signals / Hour"
			/>
			<StatCard
				icon={<RotateCw className="h-4 w-4 text-muted-foreground" />}
				label="Engine"
				value={formatCoolTimeAgo(stats.lastUpdate)}
				subtitle="Last Pipeline Run"
				span2
			/>
		</div>
	);
}

// --- MAIN PAGE ---
export default function DashboardPage() {
	const [refreshTrigger, setRefreshTrigger] = useState(0);
	const [selectedRank, setSelectedRank] = useState<number | null>(null);
	const [regionFilter, setRegionFilter] = useState("ALL");
	const { country } = useUserCountry();
	const { collapsed, expand } = useSidebarCollapsed();

	const handleDataUpdate = () => {
		setRefreshTrigger(prev => prev + 1);
	};

	return (
		<div className="flex flex-col min-h-screen w-full overflow-x-hidden">

			<div className="flex items-center w-full px-4 md:px-8 mt-4">
				{collapsed && (
					<button
						className="hidden md:flex h-10 w-10 items-center justify-center cursor-pointer shrink-0 mr-2"
						onClick={expand}
					>
						<PanelRight className="h-4 w-4 text-muted-foreground" />
					</button>
				)}
				<div className="flex-1 min-w-0 overflow-hidden relative">
					<TrendTicker regionFilter={regionFilter} />
					<div className="absolute left-0 top-0 h-full w-8 md:w-12 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
					<div className="absolute right-0 top-0 h-full w-8 md:w-12 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
				</div>
			</div>

			<div className="flex flex-col gap-6 md:gap-8 p-4 md:p-8 w-full max-w-7xl mx-auto">
				<div>
					<h1 className="text-2xl md:text-3xl font-bold tracking-tight">Overview</h1>
				</div>

				<DashboardStats trigger={refreshTrigger} />

				<TrendChart trigger={refreshTrigger} selectedRank={selectedRank} onSelectRank={setSelectedRank} regionFilter={regionFilter} />

				<TrendTable
					onUpdate={handleDataUpdate}
					selectedRank={selectedRank}
					onSelectRank={setSelectedRank}
					regionFilter={regionFilter}
					onRegionChange={setRegionFilter}
					countryName={country?.countryName || null}
					countryCode={country?.countryCode || null}
				/>
			</div>
		</div>
	);
}
