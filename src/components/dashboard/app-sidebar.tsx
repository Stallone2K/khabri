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
	FileText,
	Video,
	Hash,
	Folder,
	MoreHorizontal,
	Trash2,
	Copy,
	ExternalLink
} from "lucide-react"

import { cn } from "@/lib/utils"
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
	brief?: { // <--- Add brief type
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

const getProjectIcon = (type: string) => {
	switch (type) {
		case 'BHUPEN_SCRIPT': return <Video className="h-3 w-3 mr-2 text-red-500" />;
		case 'TWITTER_THREAD': return <Hash className="h-3 w-3 mr-2 text-blue-500" />;
		case 'BLOG_POST': return <FileText className="h-3 w-3 mr-2 text-green-500" />;
		default: return <FileText className="h-3 w-3 mr-2 text-muted-foreground" />;
	}
}

export function AppSidebar({ className, ...props }: React.ComponentProps<typeof Sidebar>) {
	const { data: session } = useSession()
	const user = session?.user
	const router = useRouter()
	const viewSource = (url?: string) => {
		if (url) window.open(url, '_blank');
		else toast.error("No source link available");
	}

	// State
	const [feeds, setFeeds] = React.useState<FeedStat[]>([])
	const [projects, setProjects] = React.useState<Project[]>([])

	const [loadingFeeds, setLoadingFeeds] = React.useState(true)
	const [loadingProjects, setLoadingProjects] = React.useState(true)

	// Feed Editing State
	const [editingId, setEditingId] = React.useState<string | null>(null)
	const [editName, setEditName] = React.useState("")
	// Project Editing State (Reusing same logic, different ID tracking)
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
		if (!session?.user) return
		try {
			const res = await fetch('/api/projects')
			if (res.ok) setProjects(await res.json())
		} catch (error) {
			console.error("Failed to load projects", error)
		} finally {
			setLoadingProjects(false)
		}
	}, [session])

	React.useEffect(() => {
		fetchFeeds();
		fetchProjects();
		const handleProjectUpdate = () => { fetchProjects(); };
		window.addEventListener("project-created", handleProjectUpdate);
		return () => { window.removeEventListener("project-created", handleProjectUpdate); };
	}, [fetchFeeds, fetchProjects]);

	// --- PROJECT ACTIONS ---
	const createNewProject = async () => {
		try {
			const res = await fetch('/api/projects', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: "New Untitled Project", type: "BLOG_POST" })
			});
			if (res.ok) {
				const newProject = await res.json();
				await fetchProjects();
				// Optional: Redirect if creating explicitly from the + button
				router.push(`/dashboard/project/${newProject.id}`);
				toast.success("Project created");
			}
		} catch (e) {
			toast.error("Failed to create project");
		}
	}

	const deleteProject = async (id: string) => {
		const toastId = toast.loading("Deleting...");
		try {
			const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error("Failed");
			toast.success("Project deleted", { id: toastId });
			await fetchProjects();
			router.refresh();
		} catch (e) {
			toast.error("Failed to delete", { id: toastId });
		}
	}

	const duplicateProject = async (id: string) => {
		const toastId = toast.loading("Duplicating...");
		try {
			const res = await fetch(`/api/projects/${id}/duplicate`, { method: 'POST' });
			if (!res.ok) throw new Error("Failed");
			toast.success("Project duplicated", { id: toastId });
			await fetchProjects();
		} catch (e) {
			toast.error("Failed to duplicate", { id: toastId });
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
			toast.success("Renamed");
			await fetchProjects();
			setEditingProjectId(null);
		} catch (e) {
			toast.error("Failed to rename");
		}
	}


	// --- FEED ACTIONS ---
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
			toast.success("Source renamed");
			await fetchFeeds(); setEditingId(null);
		} catch (err) { toast.error("Failed to rename"); }
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
		<Sidebar className={cn("w-64 border-r bg-background flex flex-col h-full", className)} {...props}>
			<SidebarHeader className="border-none py-6">
				<div className="flex items-center gap-3 px-2">
					<Image src="/Lofo.png" alt="Logo" width={32} height={32} className="rounded" />
					<span className="text-sm font-bold tracking-tight">Khabri</span>
				</div>
			</SidebarHeader>

			<SidebarContent className="px-3 flex flex-col h-full">

				{/* SECTION A: MAIN */}
				<div className="space-y-1 mb-8">
					<Button variant="ghost" asChild className="w-full justify-start hover:bg-accent/50 h-10">
						<Link href="/dashboard">
							<LayoutDashboard className="mr-3 h-4 w-4" />
							<span className="text-sm font-medium">Overview</span>
						</Link>
					</Button>
					<Button variant="ghost" asChild className="w-full justify-start hover:bg-accent/50 h-10">
						<Link href="/dashboard/sources">
							<Megaphone className="mr-3 h-4 w-4" />
							<span className="text-sm font-medium">Sources</span>
						</Link>
					</Button>

					{/* --- PROJECT SECTION --- */}
					<Collapsible className="w-full" defaultOpen>
						<CollapsibleTrigger asChild>
							<Button variant="ghost" className="w-full justify-start hover:bg-accent/50 h-10 group">
								<Folder className="mr-3 h-4 w-4" />
								<span className="text-sm font-medium flex-1 text-left">Content</span>
								<ChevronDown className="h-4 w-4 opacity-50 group-data-[state=open]:rotate-180 transition-transform" />
							</Button>
						</CollapsibleTrigger>

						<CollapsibleContent className="space-y-1 pt-1 ml-4 border-l border-muted">
							<Button variant="ghost" className="w-full justify-start h-8 text-muted-foreground hover:text-primary pl-4" onClick={createNewProject}>
								<Plus className="mr-2 h-3 w-3" />
								<span className="text-xs">New Project</span>
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
										<div key={project.id} className="group/item relative flex items-center pr-2">
											<Button variant="ghost" asChild className="w-full justify-start h-8 text-muted-foreground hover:text-foreground pl-4 pr-8">
												<Link href={`/dashboard/project/${project.id}`}>
													{getProjectIcon(project.type)}
													<span className="text-xs truncate max-w-[120px]" title={project.title}>
														{project.title}
													</span>
												</Link>
											</Button>

											{/* --- 3 DOTS MENU --- */}
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														className="h-6 w-6 p-0 absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 transition-opacity data-[state=open]:opacity-100"
													>
														<MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
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
													<DropdownMenuItem
														className="text-red-500 focus:text-red-500"
														onClick={() => deleteProject(project.id)}
													>
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

					{/* --- FEEDS SECTION --- */}
					{/* ... (This section stays exactly the same as your previous code, omitting for brevity to keep focus on changes) ... */}
					{/* Just copy your existing Feeds Collapsible block here */}
					<Collapsible className="w-full">
						<CollapsibleTrigger asChild>
							<Button variant="ghost" className="w-full justify-start hover:bg-accent/50 h-10 group">
								<Newspaper className="mr-3 h-4 w-4" />
								<span className="text-sm font-medium flex-1 text-left">Feeds</span>
								<ChevronDown className="h-4 w-4 opacity-50 group-data-[state=open]:rotate-180 transition-transform" />
							</Button>
						</CollapsibleTrigger>

						<CollapsibleContent className="space-y-1 pt-1 ml-4 border-l border-muted">
							{loadingFeeds ? (
								<div className="flex items-center px-4 py-2 text-xs text-muted-foreground">
									<Loader2 className="mr-2 h-3 w-3 animate-spin" /> Loading...
								</div>
							) : feeds.length === 0 ? (
								<div className="px-4 py-2 text-xs text-muted-foreground">No Feeds Added.</div>
							) : (
								Object.entries(groupedFeeds).map(([domain, items]) => {
									const totalUnread = items.reduce((acc, curr) => acc + curr.unreadCount, 0);
									if (items.length === 1) {
										const source = items[0];
										const isEditing = editingId === source.id;
										return (
											<div key={source.id} className="group/item relative flex items-center">
												{isEditing ? (
													<div className="flex items-center w-full px-2 gap-1 h-9">
														<Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-7 text-xs px-2" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') cancelEditing(); }} />
														<Button size="icon" variant="ghost" className="h-6 w-6" onClick={saveRename}><Check className="h-3 w-3 text-green-500" /></Button>
														<Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEditing}><X className="h-3 w-3 text-red-500" /></Button>
													</div>
												) : (
													<>
														<Button variant="ghost" asChild className="w-full justify-start h-9 text-muted-foreground hover:text-foreground pr-8">
															<Link href={`/dashboard/feeds/${source.id}`} className="flex justify-between w-full">
																<span className="text-xs truncate ml-3 max-w-[120px]" title={source.name}>{source.name}</span>
																{source.unreadCount > 0 && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full font-bold min-w-[20px] text-center">{source.unreadCount}</span>}
															</Link>
														</Button>
														<Button size="icon" variant="ghost" className="absolute right-1 h-6 w-6 opacity-0 group-hover/item:opacity-100 transition-opacity" onClick={(e) => startEditing(e, source)}><Pencil className="h-3 w-3 text-muted-foreground" /></Button>
													</>
												)}
											</div>
										);
									}
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
												{items.map(source => {
													const isEditing = editingId === source.id;
													return (
														<div key={source.id} className="group/item relative flex items-center">
															{isEditing ? (
																<div className="flex items-center w-full px-2 gap-1 h-8 pl-6">
																	<Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-6 text-[10px] px-2" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') cancelEditing(); }} />
																	<Button size="icon" variant="ghost" className="h-5 w-5" onClick={saveRename}><Check className="h-3 w-3 text-green-500" /></Button>
																	<Button size="icon" variant="ghost" className="h-5 w-5" onClick={cancelEditing}><X className="h-3 w-3 text-red-500" /></Button>
																</div>
															) : (
																<>
																	<Button variant="ghost" asChild className="w-full justify-start h-8 text-muted-foreground hover:text-foreground pl-6 pr-8">
																		<Link href={`/dashboard/feeds/${source.id}`} className="flex justify-between w-full">
																			<span className="text-[11px] truncate max-w-[110px]" title={source.name}>{source.name}</span>
																			{source.unreadCount > 0 && <span className="text-[9px] text-muted-foreground font-medium">{source.unreadCount}</span>}
																		</Link>
																	</Button>
																	<Button size="icon" variant="ghost" className="absolute right-1 h-6 w-6 opacity-0 group-hover/item:opacity-100 transition-opacity" onClick={(e) => startEditing(e, source)}><Pencil className="h-3 w-3 text-muted-foreground" /></Button>
																</>
															)}
														</div>
													);
												})}
											</CollapsibleContent>
										</Collapsible>
									);
								})
							)}
						</CollapsibleContent>
					</Collapsible>
				</div>

				{/* SECTION B: Tools */}
				<div className="space-y-1 mb-8">
					<Button variant="ghost" asChild className="w-full justify-start hover:bg-accent/50 h-10">
						<Link href="/dashboard/usage">
							<ChartArea className="mr-3 h-4 w-4" />
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

				{/* SECTION C: Settings */}
				<div className="mt-auto pb-4">
					<Button variant="ghost" asChild className="w-full justify-start hover:bg-accent/50 h-10">
						<Link href="/dashboard/settings">
							<Settings className="mr-3 h-4 w-4" />
							<span className="text-sm font-medium">Settings</span>
						</Link>
					</Button>
				</div>
			</SidebarContent>

			{/* Footer */}
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
		</Sidebar >
	)
}
