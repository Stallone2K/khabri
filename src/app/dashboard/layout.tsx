"use client"

import { useState, createContext, useContext } from "react"
import { AppSidebar } from "@/components/dashboard/app-sidebar"

export const SidebarContext = createContext<{
	collapsed: boolean
	expand: () => void
}>({ collapsed: false, expand: () => {} })

export function useSidebarCollapsed() {
	return useContext(SidebarContext)
}

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode
}) {
	const [collapsed, setCollapsed] = useState(false)

	return (
		<SidebarContext.Provider value={{ collapsed, expand: () => setCollapsed(false) }}>
			<div
				className="grid h-screen w-full overflow-hidden transition-all duration-200"
				style={{ gridTemplateColumns: collapsed ? "0fr 1fr" : "260px 1fr" }}
			>
				{/* SIDEBAR COLUMN */}
				<div className={`hidden border-r bg-background md:block h-full overflow-hidden transition-all duration-200 ${collapsed ? "w-0 min-w-0 border-r-0" : "min-w-[260px]"}`}>
					<AppSidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
				</div>

				{/* MAIN CONTENT COLUMN */}
				<div className="flex flex-col h-full overflow-hidden">
					<main className="flex-1 overflow-y-auto">
						{children}
					</main>
				</div>
			</div>
		</SidebarContext.Provider>
	)
}
