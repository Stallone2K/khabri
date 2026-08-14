'use client';

import { useState } from 'react';
import { useUserCountry } from '@/hooks/use-user-country';
import { TrendTable } from '@/components/dashboard/trend-table';
import { TrendChart } from '@/components/dashboard/trend-chart';

/**
 * Signals — the full ranked table + narrative chart (the Shopify "Orders"
 * analog). The dashboard itself stays a pure Live View.
 */
export default function SignalsPage() {
	const [refreshTrigger, setRefreshTrigger] = useState(0);
	const [selectedRank, setSelectedRank] = useState<number | null>(null);
	const [regionFilter, setRegionFilter] = useState("ALL");
	const { country } = useUserCountry();

	return (
		<div className="flex flex-col gap-6 p-4 md:p-8 w-full max-w-7xl mx-auto">
			<div>
				<h1 className="text-2xl md:text-3xl font-bold tracking-tight">Signals</h1>
				<p className="text-sm text-muted-foreground mt-1">
					Ranked trends across the world — filter by region, zone, or state.
				</p>
			</div>

			<TrendChart
				trigger={refreshTrigger}
				selectedRank={selectedRank}
				onSelectRank={setSelectedRank}
				regionFilter={regionFilter}
			/>

			<TrendTable
				onUpdate={() => setRefreshTrigger((p) => p + 1)}
				selectedRank={selectedRank}
				onSelectRank={setSelectedRank}
				regionFilter={regionFilter}
				onRegionChange={setRegionFilter}
				countryName={country?.countryName || null}
				countryCode={country?.countryCode || null}
			/>
		</div>
	);
}
