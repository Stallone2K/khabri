"use client";

import { ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type FeedTab = "feeds" | "discover" | "trending";

const tabs: { value: FeedTab; label: string }[] = [
  { value: "feeds", label: "Feeds" },
  { value: "discover", label: "Discover" },
  { value: "trending", label: "Trending" },
];

export function FeedSwitcher({
  value,
  onChange,
}: {
  value: FeedTab;
  onChange: (value: FeedTab) => void;
}) {
  const activeTab = tabs.find((t) => t.value === value)!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-fit items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm font-semibold tracking-tight hover:bg-muted/50 transition-colors cursor-pointer">
          {activeTab.label}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {tabs.map((tab) => {
          const isActive = tab.value === value;
          return (
            <DropdownMenuItem
              key={tab.value}
              onClick={() => onChange(tab.value)}
              className="cursor-pointer"
            >
              <span className="flex-1">{tab.label}</span>
              {isActive && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
