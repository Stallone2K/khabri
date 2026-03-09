"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { docsNav } from "@/lib/docs-nav";
import { cn } from "@/lib/utils";

const methodColors: Record<string, string> = {
  GET: "text-green-400",
  POST: "text-blue-400",
  PUT: "text-amber-400",
  PATCH: "text-amber-400",
  DELETE: "text-red-400",
};

export function DocsSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    const open = new Set<string>();
    for (const section of docsNav) {
      if (section.items.some((item) => item.href === pathname)) {
        open.add(section.title);
      }
    }
    // Always open Getting Started
    open.add("Getting Started");
    return open;
  });

  const toggleSection = (title: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  return (
    <nav className="space-y-1">
      {docsNav.map((section) => {
        const isOpen = openSections.has(section.title);
        const hasActive = section.items.some((item) => item.href === pathname);

        return (
          <div key={section.title}>
            <button
              onClick={() => toggleSection(section.title)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                hasActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {section.title}
              <ChevronRight
                className={cn(
                  "h-4 w-4 transition-transform",
                  isOpen && "rotate-90"
                )}
              />
            </button>
            {isOpen && (
              <div className="ml-2 border-l border-border/50 pl-2 mt-1 space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                        isActive
                          ? "text-foreground bg-muted/50"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {item.method && (
                        <span className={cn("text-[10px] font-bold font-mono w-9 shrink-0", methodColors[item.method])}>
                          {item.method}
                        </span>
                      )}
                      <span className="truncate">{item.title}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
