
'use client';

import { useState, useEffect } from 'react';
import { StatCard } from './stat-card';
import { TopKeywordsCard } from './top-keywords-card';
import { Loader2, TrendingUp, Rss, Signal } from 'lucide-react';

type StatsData = {
	topKeywords: string[];
	onTheRise: { keyword: string; change: number };
	mostActiveSource: { name: string; count: number };
	signalsIngested: number;
};

export const DashboardStats = () => {
	const [data, setData] = useState<StatsData | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const fetchStats = async () => {
			try {
				const res = await fetch('/api/trends');
				if (!res.ok) throw new Error('Failed to fetch stats');
				const statsData = await res.json();
				setData(statsData);
			} catch (error) {
				console.error(error);
			} finally {
				setIsLoading(false);
			}
		};
		fetchStats();
	}, []);

	if (isLoading) {
		return (
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
			</div>
		);
	}

	if (!data) {
		return <p className="text-muted-foreground">Could not load overview stats.</p>;
	}

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			<TopKeywordsCard keywords={data.topKeywords} />
			<StatCard
				title="On The Rise"
				value={data.onTheRise.keyword}
				subtext=" From Previous Day"
				change={data.onTheRise.change}
				icon={<TrendingUp className="h-6 w-6 text-muted-foreground" />}
			/>
			<StatCard
				title="Most Active Source"
				value={data.mostActiveSource.name}
				subtext={` With ${data.mostActiveSource.count} Articles`}
				icon={<Rss className="h-6 w-6 text-muted-foreground" />}
			/>
			<StatCard
				title="Signals Ingested"
				value={data.signalsIngested.toLocaleString()}
				subtext="In The Last 24 Hours"
				icon={<Signal className="h-6 w-6 text-muted-foreground" />}
			/>
		</div>
	);
};

const CardSkeleton = () => (
	<div className="p-4 border rounded-lg bg-card animate-pulse h-[120px]">
		<div className="h-4 bg-muted rounded w-3/4 mb-4"></div>
		<div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
		<div className="h-4 bg-muted rounded w-full"></div>
	</div>
);
