"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ALL_CATEGORIES, CATEGORY_META, type Category } from "@/lib/categories";
import { toast } from "sonner";
import { ArrowRight, Loader2, Check } from "lucide-react";

export default function OnboardingPage() {
	const router = useRouter();
	const { data: session, status } = useSession();
	const [selected, setSelected] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);
	const [checking, setChecking] = useState(true);

	useEffect(() => {
		if (status === "unauthenticated") {
			router.push("/");
			return;
		}

		if (status === "authenticated") {
			fetch("/api/user/preferences")
				.then((r) => r.json())
				.then((data) => {
					if (data.hasCompletedOnboarding) {
						router.push("/dashboard");
					} else {
						setChecking(false);
					}
				})
				.catch(() => setChecking(false));
		}
	}, [status, router]);

	const toggle = (cat: string) => {
		setSelected((prev) =>
			prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
		);
	};

	const handleContinue = async () => {
		setSaving(true);
		try {
			// Default to all categories if none selected
			const categoriesToSave =
				selected.length === 0 ? [...ALL_CATEGORIES] : selected;

			const res = await fetch("/api/user/preferences", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ categories: categoriesToSave }),
			});
			if (!res.ok) throw new Error("Failed to save");
			router.push("/dashboard");
		} catch {
			toast.error("Something went wrong. Please try again.");
			setSaving(false);
		}
	};

	if (status === "loading" || checking) {
		return (
			<div className="flex h-screen w-full items-center justify-center bg-background">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background flex flex-col">
			{/* Top bar */}
			<div className="px-6 py-4">
				<div className="flex items-center gap-2.5">
					<Image
						src="/Lofo.png"
						alt="Khabri"
						width={28}
						height={28}
						className="rounded-md"
					/>
					<span className="text-sm font-semibold">Khabri</span>
				</div>
			</div>

			{/* Main content */}
			<div className="flex-1 flex items-center justify-center px-6 py-12">
				<div className="w-full max-w-xl">
					{/* Welcome text */}
					<div className="mb-10">
						<p className="text-sm text-muted-foreground mb-2">
							Welcome, {session?.user?.name?.split(" ")[0] || "there"}
						</p>
						<h1 className="text-3xl font-bold tracking-tight">
							What Do You Want To{" "}
							<span className="font-[family-name:var(--font-forma-italic)] italic text-indigo-300">
								Track
							</span>
							?
						</h1>
						<p className="text-muted-foreground mt-2">
							Pick The Categories You Care About. You Can Always Change This Later In Settings.
						</p>
					</div>

					{/* Category grid */}
					<div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-10">
						{ALL_CATEGORIES.map((cat) => {
							const meta = CATEGORY_META[cat as Category];
							const isSelected = selected.includes(cat);

							return (
								<button
									key={cat}
									type="button"
									onClick={() => toggle(cat)}
									className={`group relative flex items-center gap-2.5 rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
										isSelected
											? `${meta.bgColor} ${meta.color} border-current`
											: "border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground"
									}`}
								>
									<span
										className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${
											isSelected
												? "bg-current border-current"
												: "border-muted-foreground/30"
										}`}
									>
										{isSelected && (
											<Check className="h-3 w-3 text-background" />
										)}
									</span>
									{meta.label}
								</button>
							);
						})}
					</div>

					{/* Actions */}
					<div className="flex items-center justify-between">
						<p className="text-xs text-muted-foreground">
							{selected.length === 0
								? "Skip To See All Categories"
								: `${selected.length} Selected`}
						</p>
						<Button
							onClick={handleContinue}
							disabled={saving}
							className="gap-2 px-6"
						>
							{saving ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" />
									Setting Up...
								</>
							) : (
								<>
									Continue
									<ArrowRight className="h-4 w-4" />
								</>
							)}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
