import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SourcesManager } from "@/components/dashboard/sources-manager";

export default function SourcesPage() {
	return (
		<div className="flex flex-col gap-8 p-4 md:p-8">
			<h1 className="text-3xl font-bold tracking-tight">Manage Sources</h1>
			<Card>
				<CardHeader>
					<CardTitle>Your RSS Feeds</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground mb-4">
						Add Or Remove The RSS Feeds You Want Khabri To Monitor. The Agent Will Check These Sources For New Articles Periodically.
					</p>
					<SourcesManager />
				</CardContent>
			</Card>
		</div>
	);
}
