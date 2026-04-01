'use client';

import { signIn } from 'next-auth/react';
import { Button } from '../ui/button';
import {
	ArrowRight,
	ChevronDown,
	TrendingUp,
	TrendingDown,
	Minus,
	Radar,
	TriangleAlert,
	Thermometer,
	ChevronsUp,
	RotateCw,
	Layers,
	Antenna,
	Earth,
	Menu,
	X,
} from 'lucide-react';
import React, { useState, useRef, useCallback } from 'react';

/* ───────────────────────── Navbar ───────────────────────── */
function Navbar() {
	const [mobileOpen, setMobileOpen] = useState(false);

	return (
		<nav className="fixed top-0 z-50 w-full">
			<div className="flex h-14 items-center justify-between px-6 pt-3 sm:justify-start sm:pl-[18%] sm:px-0">
				<div className="flex items-center gap-0.5 mr-14">
					<img src="/Lofo.png" alt="Khabri" className="h-7 w-7 rounded-md" />
					<span className="text-xl font-bold tracking-tight text-white">Khabri</span>
				</div>
				<div className="hidden items-center gap-5 md:flex">
					<a href="#pricing" className="text-[13px] text-white/80 transition hover:text-white">Pricing</a>
					<a href="#features" className="text-[13px] text-white/80 transition hover:text-white">Features</a>
					<a href="#faq" className="text-[13px] text-white/80 transition hover:text-white">FAQ</a>
				</div>
				<button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-white/80">
					{mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
				</button>
			</div>
			{mobileOpen && (
				<div className="md:hidden border-t border-white/5 bg-black/95 backdrop-blur-sm px-6 py-4 flex flex-col gap-4">
					<a href="#pricing" onClick={() => setMobileOpen(false)} className="text-sm text-white/80 transition hover:text-white">Pricing</a>
					<a href="#features" onClick={() => setMobileOpen(false)} className="text-sm text-white/80 transition hover:text-white">Features</a>
					<a href="#faq" onClick={() => setMobileOpen(false)} className="text-sm text-white/80 transition hover:text-white">FAQ</a>
				</div>
			)}
		</nav>
	);
}

/* ───────────────────────── Dashboard Mockup Data ───────────────────────── */
const MOCK_CHART_COLORS = ["#14532d", "#166534", "#15803d", "#16a34a", "#4ade80", "#84cc16", "#a3e635", "#d9f99d", "#facc15", "#fde047"];

type Region = 'all' | 'domestic' | 'international';

const MOCK_TRENDS: { rank: number; topic: string; score: number; category: string; catColor: string; spike: string | null; region: Region }[] = [
	{ rank: 1, topic: 'Trump Hints At Iran War\'s End, Plans Address; Bunker Buster Used.', score: 92, category: 'Geopolitics', catColor: 'border-red-500/40 text-red-400', spike: null, region: 'international' },
	{ rank: 2, topic: 'India Raises Jet Fuel, LPG Prices Amid Middle East Crisis.', score: 88, category: 'Finance', catColor: 'border-green-500/40 text-green-400', spike: 'CRITICAL', region: 'domestic' },
	{ rank: 3, topic: 'Malaysia Bans Foreign Cards At Pumps For RON95 Fuel.', score: 85, category: 'Geopolitics', catColor: 'border-red-500/40 text-red-400', spike: null, region: 'international' },
	{ rank: 4, topic: 'Quantum Computing Risks Flagged; Quantum-Resistant Tokens Jump.', score: 82, category: 'Crypto', catColor: 'border-orange-500/40 text-orange-400', spike: null, region: 'international' },
	{ rank: 5, topic: 'Oracle Layoffs Hit Employees, Some With Cancer, Via Email.', score: 80, category: 'Business', catColor: 'border-blue-500/40 text-blue-400', spike: null, region: 'international' },
	{ rank: 6, topic: 'China Expects Severe Flooding, Drought In 2026.', score: 78, category: 'Climate', catColor: 'border-teal-500/40 text-teal-400', spike: null, region: 'international' },
	{ rank: 7, topic: 'Rohingya Refugees Face Slashed Food Assistance In Bangladesh Camps.', score: 75, category: 'Society', catColor: 'border-pink-500/40 text-pink-400', spike: null, region: 'international' },
	{ rank: 8, topic: 'Baidu Robotaxis Freeze In China, Sparking Police Calls.', score: 72, category: 'Tech', catColor: 'border-cyan-500/40 text-cyan-400', spike: null, region: 'international' },
	{ rank: 9, topic: 'South Korean Restaurants Struggle As Oil Prices Rise.', score: 70, category: 'Business', catColor: 'border-blue-500/40 text-blue-400', spike: null, region: 'international' },
	{ rank: 10, topic: 'Zelensky Asks Trump To Relay Easter Truce Offer To Putin.', score: 68, category: 'Geopolitics', catColor: 'border-red-500/40 text-red-400', spike: null, region: 'international' },
	{ rank: 11, topic: 'ISRO Launches GSLV Mk III With Communication Satellite.', score: 65, category: 'Science', catColor: 'border-violet-500/40 text-violet-400', spike: null, region: 'domestic' },
	{ rank: 12, topic: 'RBI Holds Repo Rate Steady At 6.5% Amid Inflation Concerns.', score: 62, category: 'Finance', catColor: 'border-green-500/40 text-green-400', spike: null, region: 'domestic' },
	{ rank: 13, topic: 'Delhi Air Quality Drops To Severe Category Again.', score: 60, category: 'Climate', catColor: 'border-teal-500/40 text-teal-400', spike: null, region: 'domestic' },
	{ rank: 14, topic: 'Tata Motors EV Sales Cross 50,000 Units In Q1.', score: 58, category: 'Business', catColor: 'border-blue-500/40 text-blue-400', spike: null, region: 'domestic' },
];

const MOCK_TICKER_ITEMS = [
	{ rank: 1, topic: 'Trump Hints At Iran War\'s End, Plans Address; Bunker Buster Used.', score: 92, change: 'down' as const },
	{ rank: 2, topic: 'India Raises Jet Fuel, LPG Prices Amid Middle East Crisis.', score: 88, change: 'up' as const },
	{ rank: 3, topic: 'Malaysia Bans Foreign Cards At Pumps For RON95 Fuel.', score: 85, change: 'down' as const },
	{ rank: 4, topic: 'Quantum Computing Risks Flagged; Quantum-Resistant Tokens Jump.', score: 82, change: 'up' as const },
	{ rank: 5, topic: 'Oracle Layoffs Hit Employees, Some With Cancer, Via Email.', score: 80, change: 'neutral' as const },
	{ rank: 6, topic: 'China Expects Severe Flooding, Drought In 2026.', score: 78, change: 'up' as const },
	{ rank: 7, topic: 'Rohingya Refugees Face Slashed Food Assistance.', score: 75, change: 'down' as const },
	{ rank: 8, topic: 'Baidu Robotaxis Freeze In China, Sparking Police Calls.', score: 72, change: 'up' as const },
];

// Chart data — each line is independently shaped, lines cross, organic flow
const CHART_DATA: Record<string, { paths: string[]; xLabels: string[] }> = {
	'3': {
		xLabels: ['04:00', '04:30', '05:00', '05:30', '06:00', '06:30', '07:00'],
		paths: [
			"M30,135 C70,128 110,80 180,42 C230,28 290,52 340,38 C400,50 460,30 520,22 C545,28 560,35 570,32",
			"M30,148 C80,142 130,118 190,85 C240,72 280,95 330,78 C380,88 430,68 490,55 C530,62 555,58 570,52",
			"M30,120 C75,130 120,142 170,125 C220,108 265,90 320,72 C370,82 420,95 470,78 C520,85 548,80 570,75",
			"M30,152 C80,148 125,132 180,115 C230,105 275,118 330,100 C380,110 425,98 480,88 C525,95 550,92 570,88",
			"M30,142 C70,145 115,150 165,138 C215,128 260,115 315,108 C365,118 410,125 460,112 C510,105 545,110 570,105",
			"M30,155 C75,152 120,140 175,132 C225,128 270,138 325,125 C375,130 420,122 475,118 C525,125 550,120 570,116",
			"M30,148 C80,152 125,155 175,148 C225,140 265,132 320,128 C370,135 415,140 465,132 C515,128 548,130 570,126",
			"M30,158 C78,155 122,148 178,140 C228,136 272,142 325,135 C375,138 422,132 478,128 C528,132 552,130 570,128",
			"M30,152 C72,155 118,158 168,152 C218,148 262,142 318,138 C368,142 415,146 465,140 C515,136 548,138 570,135",
			"M30,155 C80,158 125,155 178,150 C228,148 272,152 325,146 C375,148 422,145 478,142 C528,145 552,143 570,140",
		],
	},
	'6': {
		xLabels: ['01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00'],
		paths: [
			"M30,125 C80,105 140,52 200,28 C260,45 310,82 370,55 C420,35 470,58 530,42 C550,48 562,44 570,38",
			"M30,140 C85,148 140,120 195,88 C245,65 295,78 345,62 C395,80 445,95 500,72 C535,65 555,70 570,65",
			"M30,152 C70,145 120,105 175,78 C225,92 275,115 330,95 C380,85 425,70 480,58 C530,68 552,62 570,58",
			"M30,135 C78,140 128,148 180,130 C230,115 275,98 330,85 C380,95 425,108 480,92 C530,88 550,92 570,85",
			"M30,148 C82,152 132,142 185,125 C235,112 278,105 335,98 C385,108 432,118 485,105 C532,100 555,105 570,100",
			"M30,155 C75,150 125,135 180,120 C230,128 278,138 332,125 C382,118 428,110 482,105 C532,112 555,108 570,105",
			"M30,145 C80,150 128,155 182,145 C232,138 278,128 335,122 C385,130 432,138 485,128 C532,122 555,126 570,122",
			"M30,158 C78,155 125,145 182,135 C232,132 275,140 332,130 C382,135 428,128 482,125 C532,130 555,126 570,125",
			"M30,150 C80,155 128,158 182,150 C232,145 278,140 335,136 C385,142 432,148 485,140 C532,135 555,138 570,135",
			"M30,155 C78,158 125,156 182,150 C232,148 278,152 335,145 C385,148 432,144 482,142 C532,145 555,142 570,140",
		],
	},
	'12': {
		xLabels: ['20:00', '21:00', '22:00', '23:00', '00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00'],
		paths: [
			"M30,140 C55,130 80,95 110,55 C140,30 170,22 200,38 C235,60 265,85 300,52 C330,30 360,18 390,28 C425,48 455,72 490,45 C520,32 548,40 570,35",
			"M30,148 C60,155 90,140 120,110 C150,82 180,68 210,78 C245,98 275,120 305,95 C335,75 360,62 390,72 C425,90 455,108 485,88 C520,78 548,82 570,75",
			"M30,155 C55,148 82,125 112,98 C142,80 172,92 205,108 C238,120 268,135 300,115 C332,100 360,88 392,95 C425,108 455,125 488,110 C520,100 548,105 570,98",
			"M30,135 C58,140 88,148 118,138 C148,125 178,108 210,95 C242,105 272,118 305,108 C338,98 365,88 395,95 C428,108 458,120 490,112 C522,105 548,108 570,102",
			"M30,150 C60,152 88,148 118,140 C148,130 178,120 210,112 C242,120 272,130 305,122 C338,115 365,108 395,115 C428,122 458,132 490,125 C522,118 548,120 570,115",
			"M30,142 C58,148 85,152 115,148 C145,140 175,132 208,125 C240,130 270,138 302,132 C335,125 362,120 395,125 C428,132 458,140 490,134 C522,128 548,130 570,126",
			"M30,155 C60,152 88,148 118,145 C148,140 178,135 210,130 C242,135 272,142 305,138 C338,132 365,128 395,132 C428,138 458,144 490,138 C522,134 548,136 570,132",
			"M30,148 C58,152 85,155 115,152 C145,148 175,142 208,138 C240,142 270,148 302,144 C335,140 362,136 395,140 C428,144 458,148 490,144 C522,140 548,142 570,140",
			"M30,155 C58,155 85,153 115,150 C145,148 175,146 208,144 C240,146 270,150 302,148 C335,146 362,144 395,146 C428,148 458,150 490,148 C522,146 548,148 570,146",
			"M30,152 C58,155 85,157 115,155 C145,153 175,150 208,148 C240,150 270,153 302,152 C335,150 362,148 395,150 C428,152 458,154 490,152 C522,150 548,152 570,150",
		],
	},
	'24': {
		xLabels: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '00:00', '02:00', '04:00', '06:00'],
		paths: [
			"M30,95 C55,72 82,35 115,18 C148,30 178,65 210,48 C245,28 275,15 308,32 C340,55 370,80 402,52 C435,30 465,18 498,28 C528,42 550,55 570,42",
			"M30,130 C58,142 88,120 118,90 C148,65 180,55 212,72 C245,92 275,115 308,92 C340,72 368,58 400,68 C432,85 462,105 495,88 C528,75 550,80 570,72",
			"M30,148 C55,138 82,108 115,82 C148,68 178,82 212,98 C245,110 275,125 308,105 C340,88 368,75 400,85 C432,98 462,115 495,100 C528,90 550,95 570,88",
			"M30,110 C58,118 88,130 118,122 C148,110 178,95 212,85 C245,95 275,110 308,100 C340,90 368,82 400,90 C432,100 462,112 495,105 C528,98 550,102 570,95",
			"M30,140 C58,145 88,142 118,135 C148,125 178,115 212,108 C245,115 275,125 308,118 C340,110 368,105 400,112 C432,118 462,128 495,120 C528,115 550,118 570,112",
			"M30,152 C55,148 82,138 115,128 C148,122 178,128 212,135 C245,140 275,145 308,138 C340,130 368,125 400,130 C432,136 462,142 495,135 C528,130 550,132 570,128",
			"M30,125 C58,132 88,140 118,138 C148,132 178,125 212,120 C245,125 275,132 308,128 C340,122 368,118 400,122 C432,128 462,135 495,130 C528,125 550,128 570,124",
			"M30,155 C55,152 82,145 115,138 C148,135 178,140 212,142 C245,145 275,148 308,144 C340,140 368,136 400,140 C432,144 462,148 495,144 C528,140 550,142 570,138",
			"M30,145 C58,148 88,152 118,150 C148,146 178,142 212,140 C245,142 275,146 308,144 C340,140 368,138 400,140 C432,144 462,148 495,145 C528,142 550,144 570,142",
			"M30,155 C58,155 82,153 115,150 C148,148 178,150 212,152 C245,153 275,155 308,152 C340,150 368,148 400,150 C432,152 462,154 495,152 C528,150 550,152 570,150",
		],
	},
};

const Y_LABELS: Record<string, string[]> = {
	'3': ['16', '12', '8', '4', '0'],
	'6': ['24', '18', '12', '6', '0'],
	'12': ['32', '24', '16', '8', '0'],
	'24': ['48', '36', '24', '12', '0'],
};

function getTooltipValues(timeRange: string, colIndex: number): { name: string; value: number; color: string }[] {
	const base = parseInt(timeRange) * 7 + colIndex * 13;
	return MOCK_TRENDS.slice(0, 8).map((t, i) => ({
		name: t.topic.split(/[,;.]/)[0].trim(),
		value: Math.max(0, Math.round(((base + i * 17) % 30) * (i < 3 ? 1 : 0.4))),
		color: MOCK_CHART_COLORS[i],
	})).filter(v => v.value > 0).sort((a, b) => b.value - a.value).slice(0, 8);
}

function TickerContent() {
	return (
		<>
			{MOCK_TICKER_ITEMS.map((item, i) => (
				<div key={i} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 border-r border-white/5 h-full shrink-0">
					<span className="text-[10px] sm:text-xs font-mono text-neutral-500">#{item.rank}</span>
					<span className="text-[10px] sm:text-xs font-semibold text-white whitespace-nowrap">{item.topic}</span>
					<span className={`text-[10px] sm:text-xs font-mono font-bold ${item.change === 'up' ? 'text-green-500' : item.change === 'down' ? 'text-red-500' : 'text-neutral-500'
						}`}>{item.score}</span>
					{item.change === 'up' && <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-500 shrink-0" />}
					{item.change === 'down' && <TrendingDown className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-red-500 shrink-0" />}
					{item.change === 'neutral' && <Minus className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-neutral-500 shrink-0" />}
				</div>
			))}
		</>
	);
}

function DashboardMockup() {
	const [chartRange, setChartRange] = useState('12');
	const [showChartDD, setShowChartDD] = useState(false);
	const [tableFilter, setTableFilter] = useState<Region>('all');
	const [showTableDD, setShowTableDD] = useState(false);
	const [tooltip, setTooltip] = useState<{ x: number; y: number; col: number } | null>(null);
	const chartRef = useRef<HTMLDivElement>(null);

	const chartData = CHART_DATA[chartRange];
	const timeLabels: Record<string, string> = { '3': 'Last 3 Hours', '6': 'Last 6 Hours', '12': 'Last 12 Hours', '24': 'Last 24 Hours' };
	const filterOptions: { key: Region; label: string; icon: React.ReactNode }[] = [
		{ key: 'all', label: 'All Trends', icon: <Layers className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> },
		{ key: 'domestic', label: 'Domestic', icon: <Antenna className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> },
		{ key: 'international', label: 'International', icon: <Earth className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> },
	];
	const currentFilter = filterOptions.find(f => f.key === tableFilter)!;
	const filteredTrends = tableFilter === 'all' ? MOCK_TRENDS.slice(0, 10) : MOCK_TRENDS.filter(t => t.region === tableFilter);

	const handleChartHover = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
		if (!chartRef.current) return;
		const rect = chartRef.current.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		const cols = chartData.xLabels.length;
		const col = Math.min(cols - 1, Math.max(0, Math.floor((x / rect.width) * cols)));
		setTooltip({ x, y, col });
	}, [chartData.xLabels.length]);

	return (
		<div className="flex flex-col gap-0">
			{/* Ticker */}
			<div className="flex items-center h-8 sm:h-9 border-b border-white/5 overflow-hidden">
				<div className="hidden sm:flex bg-white/[0.06] px-3 h-full items-center text-[9px] sm:text-[10px] font-bold uppercase tracking-wider border-r border-white/5 shrink-0" style={{ color: '#4ade80', textShadow: '0 0 6px rgba(74, 222, 128, 0.6), 0 0 12px rgba(74, 222, 128, 0.3)' }}>
					Live Markets
				</div>
				<div className="flex-1 min-w-0 h-full relative overflow-hidden">
					<div className="landing-marquee flex items-center h-full whitespace-nowrap">
						<TickerContent />
						<TickerContent />
					</div>
				</div>
			</div>

			<div className="p-3 sm:p-6 flex flex-col gap-3 sm:gap-5">
				<h2 className="text-base sm:text-xl font-bold text-white tracking-tight">Overview</h2>

				{/* 5 Stat Cards */}
				<div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
					{[
						{ label: 'Scanned', icon: <Radar className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-neutral-500" />, value: '2,847', subtitle: 'Total Inputs (24H)', valueClass: 'text-white' },
						{ label: 'Critical', icon: <TriangleAlert className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-500" />, value: '803', subtitle: 'Score > 80', valueClass: 'text-red-500' },
						{ label: 'Temp', icon: <Thermometer className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-500" />, value: '55°', subtitle: 'Normal Levels', valueClass: 'text-blue-500' },
						{ label: 'Velocity', icon: <ChevronsUp className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-purple-500" />, value: '3', subtitle: 'Signals / Hour', valueClass: 'text-white' },
						{ label: 'Engine', icon: <RotateCw className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-neutral-500" />, value: '1 Hr Ago', subtitle: 'Last Pipeline Run', valueClass: 'text-white' },
					].map((card, i) => (
						<div key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-2.5 sm:p-3.5">
							<div className="flex items-center justify-between mb-2 sm:mb-3">
								<span className="text-[7px] sm:text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">{card.label}</span>
								{card.icon}
							</div>
							<p className={`text-sm sm:text-xl font-bold ${card.valueClass}`}>{card.value}</p>
							<p className="text-[7px] sm:text-[10px] text-neutral-600 mt-0.5 sm:mt-1">{card.subtitle}</p>
						</div>
					))}
				</div>

				{/* Narrative Activity Chart */}
				<div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3 sm:p-5">
					<div className="flex items-center justify-between mb-3 sm:mb-4">
						<span className="text-xs sm:text-base font-bold text-white">Narrative Activity</span>
						<div className="relative">
							<button onClick={() => setShowChartDD(!showChartDD)} className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[8px] sm:text-[11px] text-neutral-300 hover:bg-white/[0.08] hover:border-white/15 transition-colors">
								{timeLabels[chartRange]}
								<ChevronDown className={`h-2.5 w-2.5 text-neutral-400 transition-transform ${showChartDD ? 'rotate-180' : ''}`} />
							</button>
							{showChartDD && (
								<div className="absolute right-0 top-full mt-1 z-50 rounded-md border border-white/10 bg-neutral-900/95 backdrop-blur-sm shadow-2xl overflow-hidden min-w-[120px]">
									{Object.entries(timeLabels).map(([key, label]) => (
										<button key={key} onClick={() => { setChartRange(key); setShowChartDD(false); }} className={`flex items-center w-full px-3 py-1.5 text-left text-[9px] sm:text-[11px] transition-colors ${chartRange === key ? 'text-white bg-white/[0.08]' : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.06]'}`}>
											{chartRange === key && <span className="w-1 h-1 rounded-full bg-white mr-2 shrink-0" />}
											{label}
										</button>
									))}
								</div>
							)}
						</div>
					</div>

					<div className="flex">
						<div className="flex flex-col justify-between text-[7px] sm:text-[9px] text-neutral-600 pr-1.5 sm:pr-2 py-0.5" style={{ height: '140px' }}>
							{Y_LABELS[chartRange].map((l, i) => <span key={i}>{l}</span>)}
						</div>
						<div ref={chartRef} className="flex-1 relative cursor-crosshair" style={{ height: '140px' }} onMouseMove={handleChartHover} onMouseLeave={() => setTooltip(null)}>
							<svg viewBox="0 0 600 160" className="w-full h-full" preserveAspectRatio="none">
								{[0, 40, 80, 120, 160].map(y => (
									<line key={y} x1="30" y1={y} x2="570" y2={y} stroke="white" strokeOpacity="0.04" strokeDasharray="3 5" />
								))}
								{chartData.paths.map((d, i) => (
									<path key={`${chartRange}-${i}`} d={d} fill="none" stroke={MOCK_CHART_COLORS[i]} strokeWidth={i < 2 ? 2 : i < 5 ? 1.5 : 1} strokeOpacity={i < 3 ? 0.8 : i < 6 ? 0.5 : 0.3} strokeLinecap="round" strokeLinejoin="round" />
								))}
								{tooltip && (
									<line x1={30 + (tooltip.col / Math.max(1, chartData.xLabels.length - 1)) * 540} y1={0} x2={30 + (tooltip.col / Math.max(1, chartData.xLabels.length - 1)) * 540} y2={160} stroke="white" strokeOpacity="0.1" strokeWidth="1" strokeDasharray="4 4" />
								)}
							</svg>
							{tooltip && (
								<div className="absolute z-50 pointer-events-none rounded-lg border border-white/10 bg-neutral-900/95 backdrop-blur-sm p-2 shadow-xl" style={{ left: Math.min(tooltip.x + 8, (chartRef.current?.clientWidth ?? 200) - 160), top: Math.max(0, tooltip.y - 80), minWidth: '140px' }}>
									<p className="text-[8px] sm:text-[9px] font-bold text-neutral-400 mb-1.5">{chartData.xLabels[tooltip.col]}</p>
									<div className="space-y-0.5">
										{getTooltipValues(chartRange, tooltip.col).map((v, i) => (
											<div key={i} className="flex items-center gap-1.5">
												<div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: v.color }} />
												<span className="text-[7px] sm:text-[9px] text-neutral-300 truncate max-w-[100px]">{v.name}</span>
												<span className="ml-auto text-[7px] sm:text-[9px] font-mono font-bold text-white">{v.value}</span>
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					</div>
					<div className="flex justify-between pl-5 sm:pl-6 pr-0 mt-1">
						{chartData.xLabels.map((t, i) => (
							<span key={i} className="text-[6px] sm:text-[8px] text-neutral-600">{t}</span>
						))}
					</div>
					<div className="flex flex-wrap justify-center gap-x-2.5 sm:gap-x-4 gap-y-0.5 sm:gap-y-1 pt-2 sm:pt-3 mt-2 sm:mt-3 border-t border-white/5">
						{MOCK_TRENDS.slice(0, 10).map((t, i) => (
							<div key={i} className="flex items-center gap-1 text-[7px] sm:text-[10px] text-neutral-500 opacity-70">
								<div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: MOCK_CHART_COLORS[i] }} />
								<span className="truncate max-w-[60px] sm:max-w-[120px]">#{t.rank} {t.topic.split(/[,;.]/)[0].trim().substring(0, 20)}...</span>
							</div>
						))}
						<span className="text-[7px] sm:text-[10px] text-neutral-600">+20 more</span>
					</div>
				</div>

				{/* Trends Table */}
				<div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3 sm:p-5">
					<div className="flex items-center justify-between mb-3 sm:mb-4">
						<span className="text-xs sm:text-base font-bold text-white">Trends</span>
						<div className="flex items-center gap-2">
							<div className="relative">
								<button onClick={() => setShowTableDD(!showTableDD)} className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[8px] sm:text-[11px] text-neutral-300 hover:bg-white/[0.08] hover:border-white/15 transition-colors">
									{currentFilter.icon}
									{currentFilter.label}
									<ChevronDown className={`h-2.5 w-2.5 text-neutral-400 transition-transform ${showTableDD ? 'rotate-180' : ''}`} />
								</button>
								{showTableDD && (
									<div className="absolute right-0 top-full mt-1 z-50 rounded-md border border-white/10 bg-neutral-900/95 backdrop-blur-sm shadow-2xl overflow-hidden min-w-[140px]">
										{filterOptions.map(({ key, label, icon }) => (
											<button key={key} onClick={() => { setTableFilter(key); setShowTableDD(false); }} className={`flex items-center gap-2 w-full px-3 py-1.5 text-left text-[9px] sm:text-[11px] transition-colors ${tableFilter === key ? 'text-white bg-white/[0.08]' : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.06]'}`}>
												{icon}
												{label}
											</button>
										))}
									</div>
								)}
							</div>
							<div className="rounded-md border border-white/10 bg-white/5 p-1 sm:p-1.5">
								<RotateCw className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-neutral-500" />
							</div>
						</div>
					</div>

					<div className="hidden sm:grid grid-cols-[24px_40px_42px_1fr_80px_72px] gap-2 text-[9px] sm:text-[10px] font-medium text-neutral-600 border-b border-white/[0.06] pb-2 mb-0.5">
						<span>Graph</span>
						<span>Rank</span>
						<span>Score</span>
						<span>Topic</span>
						<span>Category</span>
						<span className="text-right">Detected</span>
					</div>

					{filteredTrends.map((t, i) => (
						<div key={t.rank} className="grid grid-cols-[20px_1fr_36px] sm:grid-cols-[24px_40px_42px_1fr_80px_72px] gap-1.5 sm:gap-2 items-center py-2 sm:py-2.5 border-b border-white/[0.03] last:border-0">
							<div className="flex items-center justify-center">
								<div className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full" style={{ backgroundColor: MOCK_CHART_COLORS[i % MOCK_CHART_COLORS.length] }} />
							</div>
							<span className="hidden sm:block text-[11px] text-neutral-500 font-mono">#{t.rank}</span>
							<span className={`rounded-full px-1.5 sm:px-2 py-0.5 text-center font-bold text-[8px] sm:text-[11px] ${t.score >= 90 ? 'bg-red-500/20 text-red-400' :
								t.score >= 85 ? 'bg-orange-500/20 text-orange-400' :
									t.score >= 75 ? 'bg-green-500/20 text-green-400' :
										'bg-yellow-500/20 text-yellow-400'
								}`}>
								{t.score}
							</span>
							<div className="flex items-center gap-1.5 min-w-0">
								<span className="text-[10px] sm:text-[12px] text-neutral-200 truncate">{t.topic}</span>
								{t.spike && (
									<span className="shrink-0 flex items-center gap-0.5 rounded-full border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[7px] sm:text-[9px] font-bold text-red-400">
										<span className="h-1 w-1 rounded-full bg-red-500" />
										{t.spike}
									</span>
								)}
							</div>
							<span className={`hidden sm:inline-block rounded-full border px-2 py-0.5 text-center text-[8px] sm:text-[10px] font-medium ${t.catColor}`}>
								{t.category}
							</span>
							<span className="hidden sm:block text-right text-[9px] sm:text-[11px] text-neutral-600 font-mono">
								12:30 PM
							</span>
						</div>
					))}
					{filteredTrends.length === 0 && (
						<div className="py-6 text-center text-[10px] sm:text-xs text-neutral-600">No Trends Found For This Region.</div>
					)}
				</div>
			</div>
		</div>
	);
}

/* ───────────────────────── Hero ───────────────────────── */
function Hero() {
	return (
		<section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-16">
			{/* Gradient orbs */}
			<div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-b from-white/[0.07] to-transparent blur-3xl" />
			<div className="pointer-events-none absolute top-20 left-1/4 h-72 w-72 rounded-full bg-purple-500/[0.04] blur-3xl" />
			<div className="pointer-events-none absolute top-40 right-1/4 h-72 w-72 rounded-full bg-blue-500/[0.04] blur-3xl" />

			<div className="relative z-10 mx-auto max-w-4xl text-center">
				<div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-semibold text-neutral-400">
					<span className="h-2 w-2 rounded-full bg-green-500" />
					AI-Powered News Intelligence
				</div>

				<h1 className="bg-gradient-to-b from-white via-white to-neutral-500 bg-clip-text text-4xl font-bold leading-none tracking-normal text-transparent sm:text-7xl">
					Real-Time
					<br />
					News <span className="font-[family-name:var(--font-forma-italic)] italic">Intelligence</span>
				</h1>

				<p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-neutral-400 sm:text-xl">
					Know What&apos;s <span className="font-[family-name:var(--font-forma)] text-emerald-400 underline decoration-2 underline-offset-4">Trending</span> Before Everyone Else.
				</p>

				<div className="mt-10 flex justify-center">
					<Button
						onClick={() => signIn('google')}
						size="lg"
						className="h-12 rounded-full bg-white px-8 text-base font-semibold text-black hover:bg-neutral-200"
					>
						Get Started Free
						<ArrowRight className="ml-2 h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Product mockup */}
			<div className="relative z-10 mx-auto mt-10 sm:mt-16 w-full max-w-5xl">
				<div className="rounded-xl sm:rounded-2xl border border-white/10 bg-neutral-950 p-1 sm:p-2 shadow-2xl shadow-white/[0.03]">
					<div className="rounded-lg sm:rounded-xl border border-white/5 bg-black p-0.5 sm:p-1">
						{/* Browser chrome */}
						<div className="flex items-center gap-2 border-b border-white/5 px-3 sm:px-4 py-2 sm:py-3">
							<div className="flex gap-1.5">
								<div className="h-3 w-3 rounded-full bg-white/10" />
								<div className="h-3 w-3 rounded-full bg-white/10" />
								<div className="h-3 w-3 rounded-full bg-white/10" />
							</div>
							<div className="ml-4 flex-1 rounded-md bg-white/5 px-3 py-1.5 text-xs text-neutral-600">
								khabri.shownomore.com/dashboard
							</div>
						</div>
						{/* Dashboard replica */}
						<DashboardMockup />
					</div>
				</div>
				{/* Bottom glow */}
				<div className="pointer-events-none absolute -bottom-20 left-1/2 h-40 w-3/4 -translate-x-1/2 rounded-full bg-white/[0.03] blur-3xl" />
			</div>
		</section>
	);
}

/* ───────────────────────── Features (Bento Grid) ───────────────────────── */
function Features() {
	return (
		<section id="features" className="relative px-6 py-16 sm:py-32">
			<div className="mx-auto max-w-6xl">
				<div className="text-center">
					<h2 className="bg-gradient-to-b from-white via-white to-neutral-500 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-5xl">
						See What{"'"}s Under The{' '}
						<span className="font-[family-name:var(--font-forma-italic)] italic text-indigo-300">Hood</span>
					</h2>
					<p className="mx-auto mt-1 max-w-lg text-neutral-500">
						The Tools That Power Your Unfair Information Advantage.
					</p>
				</div>

				<div className="mt-10 sm:mt-16 grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-12">
					{/* Card 1: Trend Detection — Graph has blank space top-right, chart lines bottom-left */}
					<div className="group relative min-h-[280px] sm:min-h-[420px] overflow-hidden rounded-2xl border border-white/10 sm:col-span-7">
						<img src="/Graphical.png" alt="Narrative Activity Chart" className="absolute inset-0 h-full w-full object-cover object-bottom brightness-[0.7]" />
						<div className="relative z-10 p-8 sm:p-10">
							<h3 className="max-w-xs bg-gradient-to-b from-white via-white to-neutral-500 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">Spot Trends As They Emerge</h3>
						</div>
					</div>

					{/* Card 2: Developer API — blank space top-left */}
					<div className="group relative min-h-[280px] sm:min-h-[420px] overflow-hidden rounded-2xl border border-white/10 sm:col-span-5">
						<img src="/API.png" alt="Developer API" className="absolute inset-0 h-full w-full object-cover" />
						<div className="relative z-10 p-8 sm:p-10">
							<h3 className="bg-gradient-to-b from-white via-white to-neutral-500 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">Your Keys,<br />Your Data</h3>
						</div>
					</div>

					{/* Card 3: Engine Status — image IS the card, text top-right */}
					<div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] sm:col-span-5">
						<img src="/Engine.png" alt="Engine Status" className="block w-full" />
						<div className="absolute right-0 top-0 z-10 p-6 sm:p-8">
							<h3 className="bg-gradient-to-b from-white via-white to-neutral-500 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl text-right">Always On,<br />Always Fresh</h3>
						</div>
					</div>

					{/* Card 4: Narrative Timeline — chart content top-left, text bottom-right */}
					<div className="group relative min-h-[220px] sm:min-h-[320px] overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] sm:col-span-7">
						<img src="/Timeline.png" alt="Narrative Timeline" className="absolute inset-x-0 bottom-0 w-full" />
						<div className="absolute top-0 right-0 z-10 p-8 sm:p-10">
							<h3 className="bg-gradient-to-b from-white via-white to-neutral-500 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl text-right">Every Story,<br />Mapped</h3>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

/* ───────────────────────── FAQ ───────────────────────── */
const faqs = [
	{
		q: 'How Is Khabri Different From Google Alerts?',
		a: 'Google Alerts Sends You Keywords. Khabri Sends You Intelligence — AI-Ranked Trends, Narrative Timelines, And Anomaly Detection Across 170+ Sources. It\'s Not A Feed, It\'s A Radar.',
	},
	{
		q: 'What Does It Cost?',
		a: 'Nothing. Khabri Is Free To Use With A Google Account. Dashboard, Trends, API Access — All Included. No Credit Card, No Trial Period.',
	},
	{
		q: 'How Fresh Is The Data?',
		a: 'The Pipeline Runs Every 3 Hours Automatically. Need It Faster? Hit The Manual Scan Button For Instant, Real-Time Results.',
	},
	{
		q: 'Can I Plug It Into My Own Stack?',
		a: 'Yes. Full REST API With Key Management, Usage Analytics, And Webhook Alerts. Build Bots, Dashboards, Or Alerts On Top Of Khabri\'s Intelligence Layer.',
	},
	{
		q: 'What Regions Do You Cover?',
		a: '12+ Regions Including US, UK, India, EU, And More. Sources Are Primarily English Today, With Multi-Language Support Coming Soon.',
	},
	{
		q: 'Who Is This Built For?',
		a: 'Journalists, Analysts, Founders, Traders — Anyone Who Needs To Know What\'s Happening Before Everyone Else Does.',
	},
	{
		q: 'Do I Need To Set Up Anything?',
		a: 'No. Sign In With Google And Your Dashboard Is Ready Instantly. Sources Are Pre-Configured, Trends Start Flowing Immediately.',
	},
	{
		q: 'How Does Narrative Tracking Work?',
		a: 'Khabri\'s AI Groups Related Signals Into Narrative Threads And Maps How They Evolve Over Time — So You See The Full Story, Not Just Isolated Headlines.',
	},
	{
		q: 'Is My Data Private?',
		a: 'Yes. Your Dashboard, Custom Sources, And API Keys Are Scoped To Your Account. We Don\'t Share Or Sell User Data.',
	},
];

function FAQ() {
	const [open, setOpen] = useState<number | null>(null);

	return (
		<section id="faq" className="relative px-6 py-16 sm:py-32">
			<div className="mx-auto max-w-3xl">
				<h2 className="text-center bg-gradient-to-b from-white via-white to-neutral-500 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-5xl">
					Frequently Asked Questions
				</h2>

				<div className="mt-12 divide-y divide-white/10">
					{faqs.map((f, i) => (
						<div key={i}>
							<button
								onClick={() => setOpen(open === i ? null : i)}
								className="flex w-full items-center justify-between py-6 text-left"
							>
								<span className="text-sm font-medium text-white">{f.q}</span>
								<ChevronDown
									className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform ${open === i ? 'rotate-180' : ''}`}
								/>
							</button>
							{open === i && (
								<div className="pb-6 text-sm leading-relaxed text-neutral-500">
									{f.a}
								</div>
							)}
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

/* ───────────────────────── Footer CTA ───────────────────────── */
function FooterCTA() {
	return (
		<section className="relative px-6 py-16 sm:py-32 overflow-hidden">
			<div className="mx-auto flex max-w-6xl flex-col items-center text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
				{/* Left — text + CTA */}
				<div className="relative z-10 max-w-xl">
					<h2 className="bg-gradient-to-b from-white via-white to-neutral-500 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-5xl">
						Intelligence That Finds You,
						<br />
						Not The Other Way Around.
					</h2>
					<p className="mt-4 max-w-lg text-neutral-500">
						Try Khabri On Your Next News Cycle Today.
					</p>
					<Button
						onClick={() => signIn('google')}
						size="lg"
						className="mt-8 h-12 rounded-full bg-white px-8 text-base font-semibold text-black hover:bg-neutral-200"
					>
						Get Started Free
						<ArrowRight className="ml-2 h-4 w-4" />
					</Button>
				</div>

				{/* Right — tilted logo */}
				<div className="hidden sm:block relative">
					<div className="relative" style={{ transform: 'rotate(-8deg)' }}>
						<img
							src="/Lofo.png"
							alt="Khabri"
							className="h-24 w-24 sm:h-28 sm:w-28"
							style={{
								filter: 'drop-shadow(0 0 30px rgba(255,255,255,0.15))',
							}}
						/>
					</div>
				</div>
			</div>
		</section>
	);
}

/* ───────────────────────── Footer ───────────────────────── */
function Footer() {
	return (
		<footer className="px-6 pt-10 sm:pt-16 pb-10">
			<div className="mx-auto max-w-6xl border-t border-white/10 pt-10 sm:pt-16">
				{/* Top section: Logo + Link columns */}
				<div className="flex flex-col gap-12 sm:flex-row sm:justify-between">
					{/* Logo */}
					<div className="flex items-start gap-0.5 pt-1">
						<img src="/Lofo.png" alt="Khabri" className="h-7 w-7 rounded-md" />
						<span className="text-lg font-bold text-white">Khabri</span>
					</div>

					{/* Link columns */}
					<div className="grid grid-cols-2 gap-8 sm:flex sm:gap-20">
						<div>
							<h4 className="mb-4 text-sm font-semibold text-white">Resources</h4>
							<ul className="space-y-3">
								<li><a href="#" className="text-sm text-neutral-500 transition hover:text-white">Documentation</a></li>
								<li><a href="#" className="text-sm text-neutral-500 transition hover:text-white">Blog</a></li>
								<li><a href="#" className="text-sm text-neutral-500 transition hover:text-white">Changelog</a></li>
							</ul>
						</div>
						<div>
							<h4 className="mb-4 text-sm font-semibold text-white">Support</h4>
							<ul className="space-y-3">
								<li><a href="#" className="text-sm text-neutral-500 transition hover:text-white">Help Center</a></li>
								<li><a href="#" className="text-sm text-neutral-500 transition hover:text-white">Contact Us</a></li>
							</ul>
						</div>
						<div>
							<h4 className="mb-4 text-sm font-semibold text-white">Legal</h4>
							<ul className="space-y-3">
								<li><a href="#" className="text-sm text-neutral-500 transition hover:text-white">Privacy Policy</a></li>
								<li><a href="#" className="text-sm text-neutral-500 transition hover:text-white">Terms Of Service</a></li>
							</ul>
						</div>
					</div>
				</div>

				{/* All Systems Operational */}
				<div className="mt-12">
					<div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-sm text-neutral-500">
						<span className="h-2 w-2 rounded-full bg-green-500" />
						All Systems Operational
					</div>
				</div>

				{/* Bottom bar */}
				<div className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center">
					<span className="text-sm text-neutral-600">
						&copy; {new Date().getFullYear()} ShowNoMore. All Rights Reserved.
					</span>
					<div className="flex items-center gap-4">
						<a href="https://x.com" target="_blank" rel="noopener noreferrer" className="text-neutral-600 transition hover:text-white">
							<svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
						</a>
						<a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-neutral-600 transition hover:text-white">
							<svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
						</a>
					</div>
				</div>
			</div>
		</footer>
	);
}

/* ───────────────────────── Main Export ───────────────────────── */
export function Marketing() {
	return (
		<div className="min-h-screen bg-black text-white">
			<Navbar />
			<Hero />
			<Features />
			<FAQ />
			<FooterCTA />
			<Footer />
		</div>
	);
}
