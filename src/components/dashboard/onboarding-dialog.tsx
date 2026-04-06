"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
	Dialog,
	DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CategorySelector } from "./category-selector";
import { toast } from "sonner";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export function OnboardingDialog() {
	const [open, setOpen] = useState(false);
	const [selected, setSelected] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);
	const [loaded, setLoaded] = useState(false);
	const searchParams = useSearchParams();

	useEffect(() => {
		const forceOnboarding = searchParams.get("onboarding") === "true";

		fetch("/api/user/preferences")
			.then((r) => r.json())
			.then((data) => {
				if (!data.hasCompletedOnboarding || forceOnboarding) {
					setOpen(true);
				}
				if (data.preferredCategories?.length > 0) {
					setSelected(data.preferredCategories);
				}
				setLoaded(true);
			})
			.catch(() => setLoaded(true));
	}, [searchParams]);

	const handleSave = async () => {
		setSaving(true);
		try {
			const res = await fetch("/api/user/preferences", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ categories: selected }),
			});

			if (!res.ok) throw new Error("Failed to save");

			setOpen(false);
			toast.success("Preferences saved");
		} catch {
			toast.error("Failed to save preferences");
		} finally {
			setSaving(false);
		}
	};

	if (!loaded) return null;

	return (
		<Dialog open={open} onOpenChange={() => {}}>
			<DialogContent
				className="sm:max-w-2xl p-0 gap-0 overflow-hidden border-border/50"
				onInteractOutside={(e) => e.preventDefault()}
				onEscapeKeyDown={(e) => e.preventDefault()}
				showCloseButton={false}
			>
				{/* Header with logo and branding */}
				<div className="border-b bg-muted/30 px-8 py-6">
					<div className="flex items-center gap-3 mb-4">
						<Image
							src="/Lofo.png"
							alt="Khabri"
							width={36}
							height={36}
							className="rounded-lg"
						/>
						<span className="text-lg font-bold tracking-tight">Khabri</span>
					</div>
					<h2 className="text-2xl font-bold tracking-tight">
						What Do You Want To Track?
					</h2>
					<p className="text-sm text-muted-foreground mt-1">
						Select the categories that matter to you. Your feed will be personalized based on your choices.
					</p>
				</div>

				{/* Category grid */}
				<div className="px-8 py-6">
					<CategorySelector selected={selected} onChange={setSelected} />
				</div>

				{/* Footer */}
				<div className="border-t bg-muted/20 px-8 py-4 flex items-center justify-between">
					<p className="text-xs text-muted-foreground">
						{selected.length === 0
							? "No selection means all categories"
							: `${selected.length} of 13 selected`}
					</p>
					<Button
						onClick={handleSave}
						disabled={saving}
						size="sm"
						className="gap-2"
					>
						{saving ? "Saving..." : "Get Started"}
						{!saving && <ArrowRight className="h-4 w-4" />}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
