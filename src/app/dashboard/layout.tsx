import { AppSidebar } from "@/components/dashboard/app-sidebar";

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		// 1. Grid layout: Sidebar fixed width (260px), Content takes rest (1fr)
		// 2. h-screen: Forces the app to match viewport height exactly (no full page scroll)
		<div className="grid h-screen w-full md:grid-cols-[260px_1fr] overflow-hidden">

			{/* SIDEBAR COLUMN */}
			<div className="hidden border-r bg-background md:block h-full overflow-hidden">
				<AppSidebar />
			</div>

			{/* MAIN CONTENT COLUMN */}
			<div className="flex flex-col h-full overflow-hidden">
				{/* overflow-y-auto: Only this section scrolls */}
				<main className="flex-1 overflow-y-auto p-4 md:p-8">
					{children}
				</main>
			</div>
		</div>
	)
}

