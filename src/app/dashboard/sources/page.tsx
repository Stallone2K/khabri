"use client";

import { useSidebarCollapsed } from "@/app/dashboard/layout";
import { SourcesManager } from "@/components/dashboard/sources-manager";
import { PanelRight } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { UsageMeter } from "@/components/subscription/usage-meter";
import { UpgradeBanner } from "@/components/subscription/upgrade-banner";

export default function SourcesPage() {
  const { collapsed, expand } = useSidebarCollapsed();
  const { data } = useSubscription();

  const atLimit = data && data.limits.maxSources !== -1 && data.usage.currentSources >= data.limits.maxSources;

  return (
    <div className="flex flex-col min-h-screen w-full overflow-x-hidden">
      {collapsed && (
        <div className="flex items-center w-full px-4 md:px-8 mt-4">
          <button
            className="hidden md:flex h-10 w-10 items-center justify-center cursor-pointer shrink-0"
            onClick={expand}
          >
            <PanelRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-6 p-4 md:p-8 w-full max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Sources</h1>
          {data && (
            <UsageMeter
              label="Sources"
              current={data.usage.currentSources}
              max={data.limits.maxSources}
              className="w-40"
            />
          )}
        </div>

        {atLimit && (
          <UpgradeBanner
            resource="Sources"
            current={data!.usage.currentSources}
            max={data!.limits.maxSources}
          />
        )}

        <SourcesManager />
      </div>
    </div>
  );
}
