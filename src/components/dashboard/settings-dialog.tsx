"use client";

import { useState, useEffect } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ALL_CATEGORIES, CATEGORY_META, type Category } from "@/lib/categories";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
	User,
	Palette,
	LayoutGrid,
	AlertTriangle,
	Sun,
	Moon,
	Monitor,
	Check,
	MapPin,
	CreditCard,
	HelpCircle,
	ArrowUpRight,
} from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { PlanBadge } from "@/components/subscription/plan-badge";
import { UsageMeter } from "@/components/subscription/usage-meter";

type Section = "profile" | "categories" | "appearance" | "billing" | "help" | "danger";

interface SettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
	const [section, setSection] = useState<Section>("profile");
	const { data: session } = useSession();
	const user = session?.user;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-5xl p-0 gap-0 h-[min(600px,80vh)] overflow-hidden">
				<div className="flex h-full">
					{/* Inner sidebar */}
					<div className="w-44 shrink-0 border-r p-3 flex flex-col">
						<DialogHeader className="px-2 py-3 mb-2">
							<DialogTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
								Settings
							</DialogTitle>
						</DialogHeader>

						{/* General */}
						<SidebarSection label="General">
							<NavItem
								icon={<User className="h-3.5 w-3.5" />}
								label="Profile"
								active={section === "profile"}
								onClick={() => setSection("profile")}
							/>
							<NavItem
								icon={<LayoutGrid className="h-3.5 w-3.5" />}
								label="Categories"
								active={section === "categories"}
								onClick={() => setSection("categories")}
							/>
							<NavItem
								icon={<Palette className="h-3.5 w-3.5" />}
								label="Appearance"
								active={section === "appearance"}
								onClick={() => setSection("appearance")}
							/>
						</SidebarSection>

						{/* Billing & Usage */}
						<SidebarSection label="Billing & Usage">
							<NavItem
								icon={<CreditCard className="h-3.5 w-3.5" />}
								label="Usage"
								active={section === "billing"}
								onClick={() => setSection("billing")}
							/>
						</SidebarSection>

						{/* Help & Support */}
						<SidebarSection label="Help & Support">
							<NavItem
								icon={<HelpCircle className="h-3.5 w-3.5" />}
								label="Support"
								active={section === "help"}
								onClick={() => setSection("help")}
							/>
						</SidebarSection>

						{/* Danger Zone */}
						<div className="mt-auto">
							<SidebarSection label="Danger Zone">
								<NavItem
									icon={<AlertTriangle className="h-3.5 w-3.5" />}
									label="Delete Account"
									active={section === "danger"}
									onClick={() => setSection("danger")}
									destructive
								/>
							</SidebarSection>
						</div>
					</div>

					{/* Content area */}
					<div className="flex-1 overflow-y-auto p-8">
						{section === "profile" && <ProfileSection user={user} />}
						{section === "categories" && <CategoriesSection />}
						{section === "appearance" && <AppearanceSection />}
						{section === "billing" && <BillingSection />}
						{section === "help" && <HelpSection />}
						{section === "danger" && <DangerSection />}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function NavItem({
	icon,
	label,
	active,
	onClick,
	destructive,
}: {
	icon: React.ReactNode;
	label: string;
	active: boolean;
	onClick: () => void;
	destructive?: boolean;
}) {
	return (
		<button
			onClick={onClick}
			className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors w-full text-left ${
				active
					? destructive
						? "bg-red-500/10 text-red-400"
						: "bg-accent text-foreground"
					: destructive
						? "text-red-400/60 hover:text-red-400 hover:bg-red-500/5"
						: "text-muted-foreground hover:text-foreground hover:bg-accent/50"
			}`}
		>
			{icon}
			{label}
		</button>
	);
}

function SidebarSection({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="mb-3">
			<p className="px-2.5 mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
				{label}
			</p>
			<div className="flex flex-col gap-0.5">{children}</div>
		</div>
	);
}

function ProfileSection({
	user,
}: {
	user?: { name?: string | null; email?: string | null; image?: string | null };
}) {
	const [country, setCountry] = useState<{
		countryCode: string | null;
		countryName: string | null;
	}>({ countryCode: null, countryName: null });

	useEffect(() => {
		fetch("/api/user/location")
			.then((r) => r.json())
			.then(setCountry)
			.catch(() => {});
	}, []);

	return (
		<div className="space-y-8">
			<div>
				<h3 className="text-base font-semibold">Profile</h3>
				<p className="text-[13px] text-muted-foreground mt-0.5">
					Your Account Information
				</p>
			</div>

			<div className="flex items-center gap-4">
				<Avatar className="h-14 w-14 border">
					<AvatarImage src={user?.image || undefined} alt={user?.name ?? ""} />
					<AvatarFallback className="text-base">
						{user?.name?.[0]?.toUpperCase() ?? "U"}
					</AvatarFallback>
				</Avatar>
				<div className="space-y-0.5">
					<p className="text-sm font-medium">{user?.name ?? "User"}</p>
					<p className="text-[13px] text-muted-foreground">{user?.email ?? ""}</p>
				</div>
			</div>

			<div className="space-y-4">
				<div className="flex items-center gap-3 rounded-lg border px-4 py-3">
					<MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
					<div className="flex-1 min-w-0">
						<p className="text-[13px] font-medium">Country</p>
						<p className="text-xs text-muted-foreground">
							Used For Domestic vs International Classification
						</p>
					</div>
					<span className="text-[13px] text-muted-foreground">
						{country.countryName
							? `${country.countryName}`
							: "Not Detected"}
					</span>
				</div>
			</div>
		</div>
	);
}

function CategoriesSection() {
	const [selected, setSelected] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);
	const [loaded, setLoaded] = useState(false);
	const [dirty, setDirty] = useState(false);
	const [original, setOriginal] = useState<string[]>([]);

	useEffect(() => {
		fetch("/api/user/preferences")
			.then((r) => r.json())
			.then((data) => {
				const cats = data.preferredCategories || [];
				setSelected(cats);
				setOriginal(cats);
				setLoaded(true);
			})
			.catch(() => setLoaded(true));
	}, []);

	const toggle = (cat: string) => {
		const next = selected.includes(cat)
			? selected.filter((c) => c !== cat)
			: [...selected, cat];
		setSelected(next);
		setDirty(JSON.stringify([...next].sort()) !== JSON.stringify([...original].sort()));
	};

	const handleSave = async () => {
		setSaving(true);
		try {
			const res = await fetch("/api/user/preferences", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ categories: selected }),
			});
			if (!res.ok) throw new Error("Failed to save");
			setOriginal([...selected]);
			setDirty(false);
			toast.success("Categories Updated");
		} catch {
			toast.error("Failed To Save Categories");
		} finally {
			setSaving(false);
		}
	};

	if (!loaded) return <p className="text-sm text-muted-foreground">Loading...</p>;

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-base font-semibold">Categories</h3>
					<p className="text-[13px] text-muted-foreground mt-0.5">
						Choose Which Categories Appear In Your Feed
					</p>
				</div>
				{dirty && (
					<Button onClick={handleSave} disabled={saving} size="sm" className="h-8 text-xs">
						{saving ? "Saving..." : "Save Changes"}
					</Button>
				)}
			</div>

			<div className="grid grid-cols-2 gap-1.5">
				{ALL_CATEGORIES.map((cat) => {
					const meta = CATEGORY_META[cat as Category];
					const isSelected = selected.includes(cat);

					return (
						<button
							key={cat}
							type="button"
							onClick={() => toggle(cat)}
							className={`flex items-center gap-2.5 rounded-md border px-3 py-2 text-[13px] transition-all ${
								isSelected
									? "border-border bg-accent text-foreground"
									: "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50"
							}`}
						>
							<span
								className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-all ${
									isSelected
										? "bg-foreground border-foreground"
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

			<p className="text-xs text-muted-foreground">
				{selected.length === 0
					? "No Selection — All Categories Will Be Shown"
					: `${selected.length} Of 13 Selected`}
			</p>
		</div>
	);
}

function AppearanceSection() {
	const { theme, setTheme } = useTheme();

	const themes = [
		{ value: "light", label: "Light", icon: <Sun className="h-4 w-4" /> },
		{ value: "dark", label: "Dark", icon: <Moon className="h-4 w-4" /> },
		{ value: "system", label: "System", icon: <Monitor className="h-4 w-4" /> },
	];

	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-base font-semibold">Appearance</h3>
				<p className="text-[13px] text-muted-foreground mt-0.5">
					Customize Your Dashboard
				</p>
			</div>

			<div className="space-y-2">
				<p className="text-[13px] font-medium">Theme</p>
				<div className="flex gap-2">
					{themes.map((t) => (
						<button
							key={t.value}
							onClick={() => setTheme(t.value)}
							className={`flex items-center gap-2 rounded-md border px-4 py-2.5 text-[13px] transition-all ${
								theme === t.value
									? "border-foreground/20 bg-accent text-foreground"
									: "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50"
							}`}
						>
							{t.icon}
							{t.label}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

function BillingSection() {
	const { data, loading, refresh } = useSubscription();
	const [redeemCode, setRedeemCode] = useState("");
	const [redeeming, setRedeeming] = useState(false);

	const handleRedeem = async () => {
		if (!redeemCode.trim()) return;
		setRedeeming(true);
		try {
			const res = await fetch("/api/subscription/redeem", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ code: redeemCode.trim() }),
			});
			const result = await res.json();
			if (!res.ok) {
				toast.error(result.error || "Failed to redeem code");
				return;
			}
			toast.success(result.message || "Code redeemed successfully!");
			setRedeemCode("");
			refresh();
		} catch {
			toast.error("Failed to redeem code");
		} finally {
			setRedeeming(false);
		}
	};

	if (loading || !data) {
		return <p className="text-sm text-muted-foreground">Loading...</p>;
	}

	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-base font-semibold">Billing & Usage</h3>
				<p className="text-[13px] text-muted-foreground mt-0.5">
					Monitor Your Usage And Plan Details
				</p>
			</div>

			{/* Current Plan */}
			<div className="rounded-md border px-4 py-3 space-y-3">
				<div className="flex items-center justify-between">
					<p className="text-[13px] font-medium">Current Plan</p>
					<PlanBadge planSlug={data.plan.slug} planName={data.plan.name} />
				</div>
				{data.subscription.currentPeriodEnd && (
					<p className="text-xs text-muted-foreground">
						{data.subscription.status === "ACTIVE"
							? `Renews on ${new Date(data.subscription.currentPeriodEnd).toLocaleDateString()}`
							: `Expires on ${new Date(data.subscription.currentPeriodEnd).toLocaleDateString()}`}
					</p>
				)}
				{data.plan.slug === "free" && (
					<a
						href="/pricing"
						className="inline-flex items-center gap-1 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:bg-foreground/90 transition-colors"
					>
						Upgrade Plan
						<ArrowUpRight className="h-3 w-3" />
					</a>
				)}
			</div>

			{/* Usage Meters */}
			<div className="rounded-md border px-4 py-3 space-y-3">
				<p className="text-[13px] font-medium">Usage</p>
				<UsageMeter label="Sources" current={data.usage.currentSources} max={data.limits.maxSources} />
				<UsageMeter label="Tracked Trends" current={data.usage.currentProjects} max={data.limits.maxProjects} />
				<UsageMeter label="Articles" current={data.usage.currentArticles} max={data.limits.maxArticles} />
				<UsageMeter label="API Keys" current={data.usage.currentApiKeys} max={data.limits.maxApiKeys} />
				<UsageMeter label="API Calls Today" current={data.usage.apiCallsToday} max={data.limits.maxApiCallsPerDay} />
				<UsageMeter label="Webhooks" current={data.usage.currentWebhooks} max={data.limits.maxWebhooks} />
			</div>

			{/* Redeem Code */}
			<div className="rounded-md border px-4 py-3 space-y-3">
				<p className="text-[13px] font-medium">Redeem Code</p>
				<p className="text-xs text-muted-foreground">
					Have a promo code? Enter it below to upgrade your plan.
				</p>
				<div className="flex gap-2">
					<input
						type="text"
						value={redeemCode}
						onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
						placeholder="KHABRI-XXXX-XXXX"
						className="flex-1 rounded-md border bg-transparent px-3 py-1.5 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
						onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
					/>
					<Button
						size="sm"
						className="h-8 text-xs"
						onClick={handleRedeem}
						disabled={redeeming || !redeemCode.trim()}
					>
						{redeeming ? "Redeeming..." : "Redeem"}
					</Button>
				</div>
			</div>
		</div>
	);
}

function HelpSection() {
	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-base font-semibold">Help & Support</h3>
				<p className="text-[13px] text-muted-foreground mt-0.5">
					Get Help With Khabri
				</p>
			</div>

			<div className="space-y-2">
				<a
					href="/docs"
					target="_blank"
					className="flex items-center justify-between rounded-md border px-4 py-3 text-[13px] hover:bg-accent/50 transition-colors"
				>
					<div>
						<p className="font-medium">Documentation</p>
						<p className="text-xs text-muted-foreground mt-0.5">API Reference, Guides, And Tutorials</p>
					</div>
					<span className="text-muted-foreground">&rarr;</span>
				</a>
				<a
					href="mailto:stallonefernandess@gmail.com"
					className="flex items-center justify-between rounded-md border px-4 py-3 text-[13px] hover:bg-accent/50 transition-colors"
				>
					<div>
						<p className="font-medium">Contact Support</p>
						<p className="text-xs text-muted-foreground mt-0.5">Reach Out For Help Or Feedback</p>
					</div>
					<span className="text-muted-foreground">&rarr;</span>
				</a>
			</div>
		</div>
	);
}

function DangerSection() {
	const [confirming, setConfirming] = useState(false);

	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-base font-semibold">Danger Zone</h3>
				<p className="text-[13px] text-muted-foreground mt-0.5">
					Irreversible Actions
				</p>
			</div>

			<div className="rounded-md border border-red-500/20 p-4 space-y-3">
				<div>
					<p className="text-[13px] font-medium">Delete Account</p>
					<p className="text-xs text-muted-foreground mt-0.5">
						Permanently Delete Your Account And All Data. This Cannot Be Undone.
					</p>
				</div>
				{!confirming ? (
					<Button
						variant="destructive"
						size="sm"
						className="h-8 text-xs"
						onClick={() => setConfirming(true)}
					>
						Delete Account
					</Button>
				) : (
					<div className="flex items-center gap-2">
						<Button
							variant="destructive"
							size="sm"
							className="h-8 text-xs"
							onClick={() => {
								toast.error("Account Deletion Is Not Yet Implemented");
								setConfirming(false);
							}}
						>
							Confirm Delete
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="h-8 text-xs"
							onClick={() => setConfirming(false)}
						>
							Cancel
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}
