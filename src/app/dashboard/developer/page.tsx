"use client";

import { useRef } from "react";
import Link from "next/link";
import { ExternalLink, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiKeyManager, type ApiKeyManagerHandle } from "@/components/dashboard/developer/api-key-manager";

export default function DeveloperPage() {
  const managerRef = useRef<ApiKeyManagerHandle>(null);

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 w-full max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link href="/docs">
              <ExternalLink className="mr-2 h-4 w-4" />
              API Docs
            </Link>
          </Button>
          <Button size="sm" onClick={() => managerRef.current?.openCreate()}>
            <KeyRound className="mr-2 h-4 w-4" />
            Create API Key
          </Button>
        </div>
      </div>
      <ApiKeyManager ref={managerRef} />
    </div>
  );
}
