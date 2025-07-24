import { AppSidebar } from "@/components/dashboard/app-sidebar";

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<div className="grid h-screen w-full md:grid-cols-[260px_1fr]">
			<div className="hidden border-r bg-muted/40 md:block">
				<AppSidebar />
			</div>
			<div className="flex flex-col">
				<main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
					{children}
				</main>
			</div>
		</div>
	)
}
