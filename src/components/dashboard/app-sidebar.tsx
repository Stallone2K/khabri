"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession, signOut } from 'next-auth/react'
import {
	BookOpen,
	LayoutDashboard,
	Settings,
	Rss,
	TrendingUp,
	Activity,
	LogOut,
	ChevronDown,
	Newspaper,
	Loader2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Sidebar, SidebarHeader, SidebarContent, SidebarFooter } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface FeedStat {
	id: string
	name: string
	unreadCount: number
}

export function AppSidebar({ className, ...props }: React.ComponentProps<typeof Sidebar>) {
	const { data: session } = useSession()
	const user = session?.user

	// State for dynamic feeds
	const [feeds, setFeeds] = React.useState<FeedStat[]>([])
	const [loading, setLoading] = React.useState(true)

	// Fetch feeds on mount
	React.useEffect(() => {
		const fetchFeeds = async () => {
			if (!session?.user) return
			try {
				const res = await fetch('/api/sources/stats')
				if (res.ok) {
					const data = await res.json()
					setFeeds(data)
				}
			} catch (error) {
				console.error("Failed to load feeds", error)
			} finally {
				setLoading(false)
			}
		}

		fetchFeeds()
	}, [session])

	return (
		<Sidebar className={cn("w-64 border-r bg-background flex flex-col h-full", className)} {...props}>
			{/* Header: Logo + "Khabri" */}
			<SidebarHeader className="border-none py-6">
				<div className="flex items-center gap-3 px-2">
					<Image src="/Lofo.png" alt="Logo" width={32} height={32} className="rounded" />
					<span className="text-sm font-bold tracking-tight">Khabri</span>
				</div>
			</SidebarHeader>

			<SidebarContent className="px-3 flex flex-col h-full">

				{/* SECTION A: Content Management */}
				<div className="space-y-1 mb-8">
					<Button variant="ghost" asChild className="w-full justify-start hover:bg-accent/50 h-10">
						<Link href="/dashboard">
							<LayoutDashboard className="mr-3 h-4 w-4" />
							<span className="text-sm font-medium">Overview</span>
						</Link>
					</Button>

					<Button variant="ghost" asChild className="w-full justify-start hover:bg-accent/50 h-10">
						<Link href="/dashboard/sources">
							<Rss className="mr-3 h-4 w-4" />
							<span className="text-sm font-medium">Sources</span>
						</Link>
					</Button>

					<Button variant="ghost" asChild className="w-full justify-start hover:bg-accent/50 h-10">
						<Link href="/dashboard/articles">
							<BookOpen className="mr-3 h-4 w-4" />
							<span className="text-sm font-medium">Articles</span>
						</Link>
					</Button>

					{/* Feeds Dropdown */}
					<Collapsible className="w-full">
						<CollapsibleTrigger asChild>
							<Button variant="ghost" className="w-full justify-start hover:bg-accent/50 h-10 group">
								<Newspaper className="mr-3 h-4 w-4" />
								<span className="text-sm font-medium flex-1 text-left">Feeds</span>
								<ChevronDown className="h-4 w-4 opacity-50 group-data-[state=open]:rotate-180 transition-transform" />
							</Button>
						</CollapsibleTrigger>
						<CollapsibleContent className="space-y-1 pt-1 ml-4 border-l border-muted">
							{loading ? (
								<div className="flex items-center px-4 py-2 text-xs text-muted-foreground">
									<Loader2 className="mr-2 h-3 w-3 animate-spin" /> Loading...
								</div>
							) : feeds.length === 0 ? (
								<div className="px-4 py-2 text-xs text-muted-foreground">
									No Feeds Added Yet.
								</div>
							) : (
								feeds.map((source) => (
									<Button key={source.id} variant="ghost" asChild className="w-full justify-start h-9 text-muted-foreground hover:text-foreground">
										<Link href={`/dashboard/feeds/${source.id}`} className="flex justify-between w-full">
											<span className="text-xs truncate ml-3 max-w-[120px]" title={source.name}>{source.name}</span>
											{source.unreadCount > 0 && (
												<span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full font-bold min-w-[20px] text-center">
													{source.unreadCount}
												</span>
											)}
										</Link>
									</Button>
								))
							)}
						</CollapsibleContent>
					</Collapsible>
				</div>

				{/* SECTION B: Analytics & Tools */}
				<div className="space-y-1 mb-8">
					<Button variant="ghost" asChild className="w-full justify-start hover:bg-accent/50 h-10">
						<Link href="/dashboard/usage">
							<Activity className="mr-3 h-4 w-4" />
							<span className="text-sm font-medium">Usage</span>
						</Link>
					</Button>

					<Button variant="ghost" asChild className="w-full justify-start hover:bg-accent/50 h-10">
						<Link href="/dashboard/market">
							<TrendingUp className="mr-3 h-4 w-4" />
							<span className="text-sm font-medium">Market</span>
						</Link>
					</Button>
				</div>

				{/* SECTION C: Settings (Pushed to bottom) */}
				<div className="mt-auto pb-4">
					<Button variant="ghost" asChild className="w-full justify-start hover:bg-accent/50 h-10">
						<Link href="/dashboard/settings">
							<Settings className="mr-3 h-4 w-4" />
							<span className="text-sm font-medium">Settings</span>
						</Link>
					</Button>
				</div>

			</SidebarContent>

			{/* Footer: User Profile */}
			<SidebarFooter className="border-none p-4 pt-0">
				<div className="flex items-center gap-3 rounded-xl p-2 bg-accent/30">
					<Avatar className="h-9 w-9 border">
						<AvatarImage src={user?.image ?? ""} alt={user?.name ?? ""} />
						<AvatarFallback>{user?.name?.[0] ?? "U"}</AvatarFallback>
					</Avatar>
					<div className="flex flex-col flex-1 overflow-hidden">
						<span className="text-xs font-semibold truncate">{user?.name ?? "User"}</span>
						<span className="text-[10px] text-muted-foreground truncate">{user?.email ?? "Sign in"}</span>
					</div>
					<Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => signOut()}>
						<LogOut className="h-4 w-4" />
					</Button>
				</div>
			</SidebarFooter>
		</Sidebar>
	)
}
