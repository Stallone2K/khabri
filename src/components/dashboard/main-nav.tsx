'use client';

import Link from "next/link";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Megaphone, Newspaper, Settings } from "lucide-react";
import { usePathname } from "next/navigation";

export function MainNav() {
	const pathname = usePathname();

	const routes = [
		{ href: `/dashboard`, label: 'Overview', active: pathname === `/dashboard`, icon: <LayoutDashboard className="mr-3 h-5 w-5" /> },
		{ href: `/dashboard/articles`, label: 'Articles', active: pathname === `/dashboard/articles`, icon: <Newspaper className="mr-3 h-5 w-5" /> },
		{ href: `/dashboard/sources`, label: 'Sources', active: pathname === `/dashboard/sources`, icon: <Megaphone className="mr-3 h-5 w-5" /> },
		{ href: `/dashboard/settings`, label: 'Settings', active: pathname === `/dashboard/settings`, icon: <Settings className="mr-3 h-5 w-5" /> },
	];

	return (
		<nav className="flex flex-col gap-2">
			{routes.map((route) => (
				<Link
					key={route.href}
					href={route.href}
					className={cn(
						'flex items-center rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted',
						route.active ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground'
					)}
				>
					{route.icon}
					{route.label}
				</Link>
			))}
		</nav>
	);
}
