
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import React from "react";

type StatCardProps = {
	title: string;
	value: string;
	subtext: string;
	icon: React.ReactNode;
	change?: number; // Optional change indicator
};

export const StatCard = ({ title, value, subtext, icon, change }: StatCardProps) => {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-bold">{title}</CardTitle>
				{icon}
			</CardHeader>
			<CardContent>
				<div className="text-2xl font-bold capitalize">{value}</div>
				<p className="text-xs text-muted-foreground">
					{change !== undefined && (
						<span className={cn("font-semibold", change >= 0 ? "text-green-500" : "text-red-500")}>
							{change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`}
						</span>
					)}
					{subtext}
				</p>
			</CardContent>
		</Card>
	);
};
