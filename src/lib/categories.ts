export const ALL_CATEGORIES = [
	"POLITICS",
	"GEOPOLITICS",
	"TECH",
	"FINANCE",
	"CRYPTO",
	"SCIENCE",
	"MILITARY",
	"CLIMATE",
	"HEALTH",
	"SPORTS",
	"ENTERTAINMENT",
	"BUSINESS",
	"SOCIETY",
] as const;

export type Category = (typeof ALL_CATEGORIES)[number];

export const CATEGORY_META: Record<
	Category,
	{ label: string; color: string; bgColor: string }
> = {
	POLITICS: {
		label: "Politics",
		color: "text-purple-400 border-purple-400/40",
		bgColor: "bg-purple-500/20",
	},
	GEOPOLITICS: {
		label: "Geopolitics",
		color: "text-red-400 border-red-400/40",
		bgColor: "bg-red-500/20",
	},
	TECH: {
		label: "Tech",
		color: "text-cyan-400 border-cyan-400/40",
		bgColor: "bg-cyan-500/20",
	},
	FINANCE: {
		label: "Finance",
		color: "text-green-400 border-green-400/40",
		bgColor: "bg-green-500/20",
	},
	CRYPTO: {
		label: "Crypto",
		color: "text-amber-400 border-amber-400/40",
		bgColor: "bg-amber-500/20",
	},
	SCIENCE: {
		label: "Science",
		color: "text-teal-400 border-teal-400/40",
		bgColor: "bg-teal-500/20",
	},
	MILITARY: {
		label: "Military",
		color: "text-red-500 border-red-500/40",
		bgColor: "bg-red-500/20",
	},
	CLIMATE: {
		label: "Climate",
		color: "text-emerald-400 border-emerald-400/40",
		bgColor: "bg-emerald-500/20",
	},
	HEALTH: {
		label: "Health",
		color: "text-pink-400 border-pink-400/40",
		bgColor: "bg-pink-500/20",
	},
	SPORTS: {
		label: "Sports",
		color: "text-orange-400 border-orange-400/40",
		bgColor: "bg-orange-500/20",
	},
	ENTERTAINMENT: {
		label: "Entertainment",
		color: "text-violet-400 border-violet-400/40",
		bgColor: "bg-violet-500/20",
	},
	BUSINESS: {
		label: "Business",
		color: "text-blue-400 border-blue-400/40",
		bgColor: "bg-blue-500/20",
	},
	SOCIETY: {
		label: "Society",
		color: "text-yellow-400 border-yellow-400/40",
		bgColor: "bg-yellow-500/20",
	},
};

export const getCategoryStyle = (category?: string) => {
	if (!category)
		return {
			label: "General",
			color: "text-zinc-500 border-zinc-500/30",
			bgColor: "bg-zinc-500/20",
		};
	return (
		CATEGORY_META[category as Category] || {
			label: category,
			color: "text-zinc-500 border-zinc-500/30",
			bgColor: "bg-zinc-500/20",
		}
	);
};
