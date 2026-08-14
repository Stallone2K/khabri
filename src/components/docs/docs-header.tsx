"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DocsSidebar } from "./docs-sidebar";
import { useState } from "react";

export function DocsHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden h-8 w-8">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-4 pt-10">
            <SheetTitle className="text-sm font-semibold mb-4">Documentation</SheetTitle>
            <DocsSidebar onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <Link href="/docs" className="flex items-center gap-2 font-semibold text-sm">
          <Image src="/Lofo.png" alt="Logo" width={32} height={32} className="rounded" />
          Docs
        </Link>

        <div className="flex-1" />

        <Button variant="ghost" size="sm" asChild className="text-muted-foreground text-xs">
          <Link href="/dashboard">
            <ArrowLeft className="mr-1.5 h-3 w-3" />
            Dashboard
          </Link>
        </Button>
      </div>
    </header>
  );
}
