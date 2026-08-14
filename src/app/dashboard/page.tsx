'use client';

import { useState } from 'react';
import { useUserCountry } from '@/hooks/use-user-country';
import { TrendTable } from '@/components/dashboard/trend-table';
import { TrendChart } from '@/components/dashboard/trend-chart';
import { TrendTicker } from '@/components/dashboard/trend-ticker';
import { useSidebarCollapsed } from '@/app/dashboard/layout';
import { GlobeDashboard } from '@/components/globe/globe-dashboard';
import { PanelRight } from 'lucide-react';

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

			<div className="flex flex-col gap-4 md:gap-6 p-4 md:p-8 w-full max-w-7xl mx-auto">
				<GlobeDashboard />

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
