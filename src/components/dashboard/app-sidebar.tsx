"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession, signOut } from 'next-auth/react'
import {
	LayoutDashboard,
	Settings,
	Megaphone,
	TrendingUp,
	ChartArea,
	LogOut,
	ChevronDown,
	ChevronRight,
	Newspaper,
	Loader2,
	Globe,
	Pencil,
	Check,
	X,
	Plus,
	Tag,
	MoreHorizontal,
	EllipsisVertical,
	LifeBuoy,
	PanelLeft,
	Trash2,
	Copy,
	ExternalLink
} from "lucide-react"

import { cn } from "@/lib/utils"
// We use the basic components since your sidebar.tsx is the simple version
import { Sidebar, SidebarHeader, SidebarContent, SidebarFooter } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

// --- TYPES ---
interface FeedStat {
	id: string
	name: string
	url: string
	unreadCount: number
}

interface Project {
	id: string
	title: string
	type: string
	status: string
	brief?: {
		originalUrl?: string
	}
}

// --- HELPERS ---
const DOMAIN_MAPPINGS: Record<string, string> = {
	"hindustantimes": "Hindustan Times",
	"timesofindia": "Times Of India",
};

const getDomainName = (url: string) => {
	try {
		const hostname = new URL(url).hostname;
		const cleanHost = hostname.replace(/^(www|mobile|feeds|rss)\./, '');
		const namePart = cleanHost.split('.')[0].toLowerCase();
		if (DOMAIN_MAPPINGS[namePart]) return DOMAIN_MAPPINGS[namePart];
		return namePart.charAt(0).toUpperCase() + namePart.slice(1);
	} catch (e) {
		return "Other";
	}
}


interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
	collapsed?: boolean
	onToggleCollapse?: () => void
}

export function AppSidebar({ className, collapsed, onToggleCollapse, ...props }: AppSidebarProps) {
	const { data: session } = useSession()
	const user = session?.user
	const router = useRouter()

	const viewSource = (url?: string) => {
		if (url) window.open(url, '_blank');
		else toast.error("No Source Link Available");
	}

	// State
	const [feeds, setFeeds] = React.useState<FeedStat[]>([])
	const [projects, setProjects] = React.useState<Project[]>([])

	const [loadingFeeds, setLoadingFeeds] = React.useState(true)
	const [loadingProjects, setLoadingProjects] = React.useState(true)

	// Editing State
	const [editingId, setEditingId] = React.useState<string | null>(null)
	const [editName, setEditName] = React.useState("")
	const [editingProjectId, setEditingProjectId] = React.useState<string | null>(null)
	const [editProjectTitle, setEditProjectTitle] = React.useState("")

	// --- FETCH DATA ---
	const fetchFeeds = React.useCallback(async () => {
		if (!session?.user) return
		try {
			const res = await fetch('/api/sources/stats')
			if (res.ok) setFeeds(await res.json())
		} catch (error) {
			console.error("Failed to load feeds", error)
		} finally {
			setLoadingFeeds(false)
		}
	}, [session])

	const fetchProjects = React.useCallback(async () => {
		try {
			const res = await fetch('/api/projects')
			if (res.ok) setProjects(await res.json())
		} catch (error) {
			console.error("Failed to load projects", error)
		} finally {
			setLoadingProjects(false)
		}
	}, [])

	React.useEffect(() => {
		fetchFeeds();
		fetchProjects();
		const handleProjectUpdate = () => { fetchProjects(); };
		window.addEventListener("project-created", handleProjectUpdate);
		return () => { window.removeEventListener("project-created", handleProjectUpdate); };
	}, [fetchFeeds, fetchProjects]);

	// --- ACTIONS ---
	const createNewProject = async () => {
		try {
			const res = await fetch('/api/projects', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: "New Tracked Trend", type: "TRACKED_TREND" })
			});
			if (res.ok) {
				const newProject = await res.json();
				await fetchProjects();
				router.push(`/dashboard/project/${newProject.id}`);
				toast.success("Project Created");
			}
		} catch (e) {
			toast.error("Failed To Create Project");
		}
	}

	const deleteProject = async (id: string) => {
		const toastId = toast.loading("Deleting\u2026");
		try {
			const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error("Failed");
			toast.success("Project Deleted", { id: toastId });
			await fetchProjects();
			router.refresh();
		} catch (e) {
			toast.error("Failed To Delete", { id: toastId });
		}
	}

	const duplicateProject = async (id: string) => {
		const toastId = toast.loading("Duplicating\u2026");
		try {
			const res = await fetch(`/api/projects/${id}/duplicate`, { method: 'POST' });
			if (!res.ok) throw new Error("Failed");
			toast.success("Project Duplicated", { id: toastId });
			await fetchProjects();
		} catch (e) {
			toast.error("Failed To Duplicate", { id: toastId });
		}
	}

	const startRenamingProject = (project: Project) => {
		setEditingProjectId(project.id);
		setEditProjectTitle(project.title);
	}
	const cancelRenamingProject = () => {
		setEditingProjectId(null);
		setEditProjectTitle("");
	}
	const saveProjectRename = async () => {
		if (!editingProjectId || !editProjectTitle.trim()) return;
		try {
			const res = await fetch(`/api/projects/${editingProjectId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: editProjectTitle })
			});
			if (!res.ok) throw new Error("Failed");
			toast.success("Renamed Successfully");
			await fetchProjects();
			setEditingProjectId(null);
		} catch (e) {
			toast.error("Failed To Rename");
		}
	}

	const startEditing = (e: React.MouseEvent, feed: FeedStat) => {
		e.preventDefault(); e.stopPropagation();
		setEditingId(feed.id); setEditName(feed.name);
	}
	const cancelEditing = () => { setEditingId(null); setEditName(""); }
	const saveRename = async () => {
		if (!editingId || !editName.trim()) return;
		try {
			const res = await fetch('/api/sources', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: editingId, name: editName }),
			});
			if (!res.ok) throw new Error("Failed to update");
			toast.success("Source Renamed");
			await fetchFeeds(); setEditingId(null);
		} catch (err) { toast.error("Failed To Rename"); }
	}

	const groupedFeeds = React.useMemo(() => {
		const groups: Record<string, FeedStat[]> = {};
		feeds.forEach(feed => {
			const domain = getDomainName(feed.url);
			if (!groups[domain]) groups[domain] = [];
			groups[domain].push(feed);
		});
		return groups;
	}, [feeds]);

	return (
		<Sidebar className={cn("w-full h-full border-none bg-background", className)} {...props}>
			{/* HEADER */}
			<SidebarHeader className="py-6 px-4">
				<div className="flex items-center gap-3 group/header">
					<Image src="/Lofo.png" alt="Logo" width={32} height={32} className="rounded" />
					<span className="text-sm font-bold tracking-tight flex-1">Khabri</span>
					{onToggleCollapse && (
						<button
							className="h-7 w-7 flex items-center justify-center opacity-0 group-hover/header:opacity-100 transition-opacity cursor-pointer"
							onClick={onToggleCollapse}
						>
							<PanelLeft className="h-4 w-4 text-muted-foreground" />
						</button>
					)}
				</div>
			</SidebarHeader>

			{/* SCROLLABLE CONTENT */}
			<SidebarContent className="px-3">

				{/* NAVIGATION */}
				<div className="space-y-1 mb-8">
					<Button variant="ghost" asChild className="w-full justify-start hover:bg-accent/50 h-9">
						<Link href="/dashboard">
							<LayoutDashboard className="mr-3 h-4 w-4" />
							<span className="text-sm font-medium">Overview</span>
						</Link>
					</Button>
					<Button variant="ghost" asChild className="w-full justify-start hover:bg-accent/50 h-9">
						<Link href="/dashboard/sources">
							<Megaphone className="mr-3 h-4 w-4" />
							<span className="text-sm font-medium">Sources</span>
						</Link>
					</Button>
					{/* PROJECTS COLLAPSIBLE */}
					<Collapsible className="w-full" defaultOpen>
						<CollapsibleTrigger asChild>
							<Button variant="ghost" className="w-full justify-start hover:bg-accent/50 h-9 group">
								<Tag className="mr-3 h-4 w-4" />
								<span className="text-sm font-medium flex-1 text-left">Tracked Trends</span>
								<ChevronDown className="h-4 w-4 opacity-50 group-data-[state=open]:rotate-180 transition-transform" />
							</Button>
						</CollapsibleTrigger>
						<CollapsibleContent className="space-y-1 pt-1 ml-4 border-l border-muted">
							<Button variant="ghost" className="w-full justify-start h-8 text-muted-foreground hover:text-primary pl-4" onClick={createNewProject}>
								<Plus className="mr-2 h-3 w-3" />
								<span className="text-xs">Track Trend</span>
							</Button>

							{loadingProjects ? (
								<div className="flex items-center px-4 py-2 text-xs text-muted-foreground"><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Loading...</div>
							) : projects.length === 0 ? (
								<div className="px-4 py-2 text-xs text-muted-foreground">No Projects.</div>
							) : (
								projects.map(project => {
									const isEditing = editingProjectId === project.id;
									if (isEditing) {
										return (
											<div key={project.id} className="flex items-center w-full px-2 gap-1 h-8 pl-4">
												<Input
													value={editProjectTitle}
													onChange={(e) => setEditProjectTitle(e.target.value)}
													className="h-6 text-xs px-2"
													autoFocus
													onKeyDown={(e) => { if (e.key === 'Enter') saveProjectRename(); if (e.key === 'Escape') cancelRenamingProject(); }}
												/>
												<Button size="icon" variant="ghost" className="h-5 w-5" onClick={saveProjectRename}><Check className="h-3 w-3 text-green-500" /></Button>
												<Button size="icon" variant="ghost" className="h-5 w-5" onClick={cancelRenamingProject}><X className="h-3 w-3 text-red-500" /></Button>
											</div>
										)
									}
									return (
										<div key={project.id} className="group/item relative flex items-center">
											<Button variant="ghost" asChild className="w-full justify-start h-8 text-muted-foreground hover:text-foreground pl-4 pr-8">
												<Link href={`/dashboard/project/${project.id}`}>
													<TrendingUp className="h-3 w-3 mr-2 text-muted-foreground" />
													<span className="text-xs truncate max-w-[140px]" title={project.title}>
														{project.title}
													</span>
												</Link>
											</Button>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button className="h-6 w-6 p-0 absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 transition-opacity data-[state=open]:opacity-100" variant="ghost">
														<MoreHorizontal className="h-4 w-4 text-muted-foreground" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="start" side="right" className="w-40">
													<DropdownMenuItem onClick={() => startRenamingProject(project)}>
														<Pencil className="mr-2 h-3.5 w-3.5" /> Rename
													</DropdownMenuItem>
													<DropdownMenuItem onClick={() => duplicateProject(project.id)}>
														<Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
													</DropdownMenuItem>
													{project.brief?.originalUrl && (
														<DropdownMenuItem onClick={() => viewSource(project.brief?.originalUrl)}>
															<ExternalLink className="mr-2 h-3.5 w-3.5" /> View Source
														</DropdownMenuItem>
													)}
													<DropdownMenuSeparator />
													<DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={() => deleteProject(project.id)}>
														<Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</div>
									)
								})
							)}
						</CollapsibleContent>
					</Collapsible>

					{/* FEEDS COLLAPSIBLE */}
					<Collapsible className="w-full">
						<CollapsibleTrigger asChild>
							<Button variant="ghost" className="w-full justify-start hover:bg-accent/50 h-9 group">
								<Newspaper className="mr-3 h-4 w-4" />
								<span className="text-sm font-medium flex-1 text-left">Feeds</span>
								<ChevronDown className="h-4 w-4 opacity-50 group-data-[state=open]:rotate-180 transition-transform" />
							</Button>
						</CollapsibleTrigger>
						<CollapsibleContent className="space-y-1 pt-1 ml-4 border-l border-muted">
							{loadingFeeds ? (
								<div className="flex items-center px-4 py-2 text-xs text-muted-foreground"><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Loading...</div>
							) : feeds.length === 0 ? (
								<div className="px-4 py-2 text-xs text-muted-foreground">No Feeds Added.</div>
							) : (
								Object.entries(groupedFeeds).map(([domain, items]) => {
									const totalUnread = items.reduce((acc, curr) => acc + curr.unreadCount, 0);
									return (
										<Collapsible key={domain} className="w-full">
											<CollapsibleTrigger asChild>
												<Button variant="ghost" className="w-full justify-start h-9 text-muted-foreground hover:text-foreground group/sub">
													<Globe className="mr-2 h-3 w-3 opacity-70" />
													<span className="text-xs truncate flex-1 text-left">{domain}</span>
													<div className="flex items-center gap-2">
														{totalUnread > 0 && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full font-bold min-w-[20px] text-center">{totalUnread}</span>}
														<ChevronRight className="h-3 w-3 opacity-50 transition-transform group-data-[state=open]/sub:rotate-90" />
													</div>
												</Button>
											</CollapsibleTrigger>
											<CollapsibleContent className="space-y-0.5 pt-0.5 ml-2">
												{items.map(source => (
													<div key={source.id} className="group/item relative flex items-center">
														<Button variant="ghost" asChild className="w-full justify-start h-8 text-muted-foreground hover:text-foreground pl-6 pr-8">
															<Link href={`/dashboard/feeds/${source.id}`} className="flex justify-between w-full">
																<span className="text-[11px] truncate max-w-[110px]" title={source.name}>{source.name}</span>
																{source.unreadCount > 0 && <span className="text-[9px] text-muted-foreground font-medium">{source.unreadCount}</span>}
															</Link>
														</Button>
													</div>
												))}
											</CollapsibleContent>
										</Collapsible>
									);
								})
							)}
						</CollapsibleContent>
					</Collapsible>
				</div>

				{/* USAGE & MARKET */}
				<div className="space-y-1 mb-8">
					<Button variant="ghost" asChild className="w-full justify-start hover:bg-accent/50 h-9">
						<Link href="/dashboard/usage">
							<ChartArea className="mr-3 h-4 w-4" />
							<span className="text-sm font-medium">Usage</span>
						</Link>
					</Button>
					<Button variant="ghost" asChild className="w-full justify-start hover:bg-accent/50 h-9">
						<Link href="/dashboard/market">
							<TrendingUp className="mr-3 h-4 w-4" />
							<span className="text-sm font-medium">Market</span>
						</Link>
					</Button>
				</div>
			</SidebarContent>

			{/* FOOTER - FIXED & ALIGNED */}
			<SidebarFooter className="border-t p-4 bg-background z-10">
				{/* Settings Button */}
				<Button variant="ghost" asChild className="w-full justify-start hover:bg-accent/50 h-9 mb-2 text-muted-foreground hover:text-foreground">
					<Link href="/dashboard/settings">
						<Settings className="mr-3 h-4 w-4" />
						<span className="text-sm font-medium">Settings</span>
					</Link>
				</Button>

				{/* User Profile Block */}
				<div className="flex items-center gap-3 p-2">
					<Avatar className="h-9 w-9 border shrink-0">
						<AvatarImage
							src={user?.image || undefined}
							alt={user?.name ?? ""}
						/>
						<AvatarFallback className="bg-muted text-muted-foreground">{user?.name?.[0]?.toUpperCase() ?? "U"}</AvatarFallback>
					</Avatar>

					<div className="flex flex-col flex-1 overflow-hidden min-w-0">
						<span className="text-xs font-semibold truncate text-foreground">
							{user?.name ?? "User"}
						</span>
						<span className="text-[10px] text-muted-foreground truncate">
							{user?.email ?? "Sign in"}
						</span>
					</div>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 ml-auto">
								<EllipsisVertical className="h-4 w-4 text-muted-foreground" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" side="top" className="w-44 p-1 rounded-md text-[11px]">
							<DropdownMenuItem className="text-[11px] h-7">
								<Settings className="mr-2 h-3 w-3" /> Settings
							</DropdownMenuItem>
							<DropdownMenuItem className="text-[11px] h-7">
								<Megaphone className="mr-2 h-3 w-3" /> Feedback
							</DropdownMenuItem>
							<DropdownMenuSeparator className="my-1" />
							<DropdownMenuItem className="text-red-500 focus:text-red-500 text-[11px] h-7" onClick={() => signOut()}>
								<LifeBuoy className="mr-2 h-3 w-3 text-red-500" /> Sign Out
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</SidebarFooter>
		</Sidebar>
	)
}

