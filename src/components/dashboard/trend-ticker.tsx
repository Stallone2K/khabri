"use client";

import { useState, useEffect } from "react";
import Marquee from "react-fast-marquee";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface TickerItem {
	id: string;
	rank: number;
	topic: string;
	score: number;
	change: 'up' | 'down' | 'neutral';
}

interface TrendTickerProps {
	regionFilter?: string;
}

interface CriticalAnomaly {
	id: string;
	label: string;
	zScore: number;
}

export function TrendTicker({ regionFilter = "ALL" }: TrendTickerProps) {
	const [items, setItems] = useState<TickerItem[]>([]);
	const [criticalAnomalies, setCriticalAnomalies] = useState<CriticalAnomaly[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const regionParam = regionFilter && regionFilter !== "ALL" ? `?region=${regionFilter}` : "";
		fetch(`/api/trends/ticker${regionParam}`)
			.then(res => res.json())
			.then(data => {
				setItems(Array.isArray(data) ? data : []);
				setLoading(false);
			})
			.catch(err => console.error(err));

		// Fetch CRITICAL anomalies for ticker
		fetch("/api/intelligence/anomalies?active=true&severity=CRITICAL&limit=5")
			.then(res => res.json())
			.then(data => setCriticalAnomalies(data.anomalies || []))
			.catch(() => {});
	}, [regionFilter]);

	if (loading || items.length === 0) return null;

	return (
		// FIX 1: The outer container must be explicitly relative and w-full
		<div className="w-full h-10 flex items-center relative overflow-hidden z-40">

			{/* Label: Static width */}
			<div className="bg-primary/10 text-primary px-4 h-full flex items-center justify-center text-xs font-bold uppercase tracking-wider border-r border-white/10 shrink-0 z-20 relative">
				Live Markets
			</div>

			{/* FIX 2: The wrapper is CRITICAL.
          - flex-1: Take remaining space
          - w-0 or min-w-0: IGNORE the child's natural width (This fixes the overflow)
          - h-full: Fill height
      */}
			<div className="flex-1 min-w-0 w-0 h-full relative">
				<Marquee
					gradient={false}
					speed={40}
					autoFill={true} // Ensures it fills space smoothly without gaps
					className="h-full flex items-center overflow-hidden"
				>
					{criticalAnomalies.map((anomaly) => (
						<div key={`anomaly-${anomaly.id}`} className="flex items-center space-x-2 px-6 border-r border-red-500/20 h-full bg-red-500/5">
							<span className="bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Spike</span>
							<span className="text-sm font-semibold text-red-400 whitespace-nowrap">{anomaly.label}</span>
							<span className="text-xs font-mono font-bold text-red-500">z={anomaly.zScore.toFixed(1)}</span>
						</div>
					))}
					{items.map((item) => (
						<div key={item.id} className="flex items-center space-x-3 px-6 border-r border-white/5 h-full">

							<span className="text-xs font-mono text-muted-foreground">
								#{item.rank}
							</span>

							<span className="text-sm font-semibold text-white whitespace-nowrap">
								{item.topic}
							</span>

							<div className={`flex items-center space-x-1 text-xs font-mono font-bold
                ${item.change === 'up' ? 'text-green-500' :
									item.change === 'down' ? 'text-red-500' : 'text-slate-500'}
              `}>
								<span>{item.score}</span>
								{item.change === 'up' && <TrendingUp className="h-3 w-3" />}
								{item.change === 'down' && <TrendingDown className="h-3 w-3" />}
								{item.change === 'neutral' && <Minus className="h-3 w-3" />}
							</div>

						</div>
					))}
				</Marquee>
			</div>
		</div>
	);
}
