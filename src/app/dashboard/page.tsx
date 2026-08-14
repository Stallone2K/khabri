'use client';

import { useState } from 'react';
import { TrendTicker } from '@/components/dashboard/trend-ticker';
import { MonitorDashboard } from '@/components/monitor/monitor-dashboard';
import { useSidebarCollapsed } from '@/app/dashboard/layout';
import { PanelRight } from 'lucide-react';

/**
 * The Monitor — Live View (MONITOR-PLAN.md P1). Ambient globe + data rail.
 * The full signals table lives at /dashboard/signals.
 */
export default function DashboardPage() {
	const [regionFilter] = useState("ALL");
	const { collapsed, expand } = useSidebarCollapsed();

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

			<div className="flex-1 p-4 md:p-6 w-full max-w-[1600px] mx-auto">
				<MonitorDashboard />
			</div>
		</div>
	);
}
