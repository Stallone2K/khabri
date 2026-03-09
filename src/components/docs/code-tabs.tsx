"use client";

import { useState, useEffect } from "react";
import { CopyButton } from "./copy-button";

const STORAGE_KEY = "khabri-docs-lang";

interface CodeTab {
  lang: string;
  label: string;
  code: string;
  html: string;
}

interface CodeTabsClientProps {
  tabs: CodeTab[];
}

export function CodeTabsClient({ tabs }: CodeTabsClientProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.lang || "bash");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && tabs.some((t) => t.lang === saved)) {
      setActiveTab(saved);
    }
  }, [tabs]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    localStorage.setItem(STORAGE_KEY, value);
  };

  const active = tabs.find((t) => t.lang === activeTab) || tabs[0];

  return (
    <div className="my-4 rounded-lg border border-border overflow-hidden bg-[hsl(0,0%,6%)]">
      {/* Tab bar header */}
      <div className="flex items-center justify-between border-b border-border bg-[hsl(0,0%,8%)] px-2 md:px-3 py-1.5 overflow-x-auto">
        <div className="flex items-center gap-0.5 md:gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.lang}
              onClick={() => handleTabChange(tab.lang)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                tab.lang === activeTab
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {/* Code content */}
      <div className="group relative">
        <CopyButton code={active.code} />
        <div
          className="overflow-x-auto p-3 md:p-4 text-xs md:text-sm [&_pre]:!bg-transparent [&_pre]:!m-0 [&_code]:!bg-transparent"
          dangerouslySetInnerHTML={{ __html: active.html }}
        />
      </div>
    </div>
  );
}
