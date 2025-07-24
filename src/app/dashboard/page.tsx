
import { DashboardStats } from '@/components/dashboard/dashboard';
import { TrendChart } from '@/components/dashboard/trend-chart';

export default function DashboardPage() {
	return (
		<div className="flex flex-col gap-8">
			<h1 className="text-3xl font-bold tracking-tight">Overview</h1>

			{/* Real-time Stat Cards */}
			<DashboardStats />

			{/* Real-time Trend Chart */}
			<TrendChart />
		</div>
	);
}
