"use client"

import { useState, createContext, useContext } from "react"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export const SidebarContext = createContext<{
	collapsed: boolean
	expand: () => void
	mobileOpen: boolean
	setMobileOpen: (open: boolean) => void
}>({ collapsed: false, expand: () => {}, mobileOpen: false, setMobileOpen: () => {} })

export function useSidebarCollapsed() {
	return useContext(SidebarContext)
}

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode
}) {
	const [collapsed, setCollapsed] = useState(false)
	const [mobileOpen, setMobileOpen] = useState(false)

	return (
		<SidebarContext.Provider value={{ collapsed, expand: () => setCollapsed(false), mobileOpen, setMobileOpen }}>
			{/* Mobile header */}
			<div className="md:hidden sticky top-0 z-50 flex items-center gap-3 border-b bg-background px-4 h-14">
				<Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setMobileOpen(true)}>
					<Menu className="h-5 w-5" />
				</Button>
				<Link href="/dashboard" className="flex items-center gap-2">
					<Image src="/Lofo.png" alt="Logo" width={28} height={28} className="rounded" />
					<span className="text-sm font-bold">Khabri</span>
				</Link>
			</div>

			{/* Mobile sidebar drawer */}
			<Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
				<SheetContent side="left" className="w-[280px] p-0">
					<SheetTitle className="sr-only">Navigation</SheetTitle>
					<AppSidebar onNavigate={() => setMobileOpen(false)} />
				</SheetContent>
			</Sheet>

			<div className="flex h-[calc(100dvh-3.5rem)] md:h-screen w-full overflow-hidden">
				{/* Desktop sidebar - hidden on mobile */}
				<div
					className={`hidden md:block border-r bg-background h-full overflow-hidden transition-all duration-200 ${collapsed ? "w-0 min-w-0 border-r-0" : ""}`}
					style={{ width: collapsed ? 0 : 260, minWidth: collapsed ? 0 : 260 }}
				>
					<AppSidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
				</div>

				{/* Main content - single render */}
				<div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
					<main className="flex-1 overflow-y-auto">
						{children}
					</main>
				</div>
			</div>
		</SidebarContext.Provider>
	)
}
