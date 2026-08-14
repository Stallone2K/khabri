import type { Metadata } from "next";
import { DocsHeader } from "@/components/docs/docs-header";
import { DocsSidebar } from "@/components/docs/docs-sidebar";

export const metadata: Metadata = {
  title: "API Documentation | Khabri",
  description: "API reference for the Khabri Intelligence API",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <DocsHeader />
      <div className="mx-auto flex max-w-[1400px]">
        <aside className="hidden md:block w-[240px] shrink-0 border-r border-border">
          <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-6 px-4">
            <DocsSidebar />
          </div>
        </aside>
        <main className="flex-1 min-w-0">
          <div className="mx-auto max-w-3xl px-4 md:px-6 py-6 md:py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
