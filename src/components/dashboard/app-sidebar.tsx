// /components/dashboard/app-sidebar.tsx

import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar"
import { MainNav } from "./main-nav"
import { UserNav } from "./user-nav"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
export function AppSidebar() {
	return (
		<Sidebar>
			<SidebarHeader>
				<Link href="/dashboard">
					<div className="flex gap-2 items-center">
						<img src="/Lofo.png" alt="Khabri" className="h-8 w-8" />
						<h1 className="text-lg font-black tracking-tight">Khabri</h1>
					</div>
				</Link>
			</SidebarHeader>
			<SidebarContent className="p-4">
				<MainNav />
			</SidebarContent>
			<Separator />
			<SidebarFooter>
				<UserNav />
			</SidebarFooter>
		</Sidebar>
	)
}
