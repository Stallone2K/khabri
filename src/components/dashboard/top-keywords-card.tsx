
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hash } from "lucide-react";
import { cn } from "@/lib/utils";

export const keywordColors = [
	"bg-sky-400",
	"bg-amber-400",
	"bg-emerald-400",
	"bg-rose-400",
	"bg-indigo-400",
];

type TopKeywordsCardProps = {
	keywords: string[];
};

export const TopKeywordsCard = ({ keywords }: TopKeywordsCardProps) => {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-bold">Top 5 Keywords</CardTitle>
				<Hash className="h-6 w-6 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div className="flex flex-col space-y-2 pt-1">
					{keywords.length > 0 ? keywords.map((keyword, index) => (
						<div key={keyword} className="flex items-center">
							<span className={cn("h-2.5 w-2.5 rounded-full mr-2", keywordColors[index % keywordColors.length])} />
							<span className="text-sm font-medium capitalize">{keyword}</span>
						</div>
					)) : <p className="text-sm text-muted-foreground">Not Enough Data Yet.</p>}
				</div>
			</CardContent>
		</Card>
	);
};
