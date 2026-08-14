"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  Trash2,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Source = {
  id: string;
  name: string;
  url: string;
  category: string | null;
  type: string;
  isActive: boolean;
  createdAt: string;
};

export function SourcesManager() {
  const [sources, setSources] = useState<Source[]>([]);
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Detail dialog
  const [detailSource, setDetailSource] = useState<Source | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchSources = async () => {
    try {
      const res = await fetch("/api/sources");
      if (!res.ok) throw new Error("Failed to fetch sources");
      const data = await res.json();
      setSources(data);
    } catch {
      toast.error("Could not load sources");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = newSourceUrl.trim();
    if (!url) return;

    setIsAdding(true);
    try {
      try {
        new URL(url);
      } catch {
        throw new Error("Invalid URL — include https://");
      }

      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add source");

      setNewSourceUrl("");
      toast.success(`${data.name} added`);
      await fetchSources();
    } catch (err: any) {
      toast.error(err.message || "Failed to add source");
    } finally {
      setIsAdding(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    const original = [...sources];
    const toDelete = [...selected];
    const count = toDelete.length;

    setSources((prev) => prev.filter((s) => !selected.has(s.id)));
    setSelected(new Set());

    try {
      await Promise.all(
        toDelete.map((id) =>
          fetch("/api/sources", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          })
        )
      );
      toast.success(`${count} source${count > 1 ? "s" : ""} removed`);
    } catch {
      setSources(original);
      toast.error("Failed to delete some sources");
    }
  };

  const handleBulkToggle = async (activate: boolean) => {
    if (selected.size === 0) return;
    const original = [...sources];
    const toToggle = [...selected];

    setSources((prev) =>
      prev.map((s) =>
        selected.has(s.id) ? { ...s, isActive: activate } : s
      )
    );
    setSelected(new Set());

    try {
      await Promise.all(
        toToggle.map((id) =>
          fetch("/api/sources", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, isActive: activate }),
          })
        )
      );
      toast.success(
        `${toToggle.length} source${toToggle.length > 1 ? "s" : ""} ${activate ? "activated" : "deactivated"}`
      );
    } catch {
      setSources(original);
      toast.error("Failed to update sources");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === sources.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sources.map((s) => s.id)));
    }
  };

  const allSelected = sources.length > 0 && selected.size === sources.length;

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return url;
    }
  };

  return (
    <div className="space-y-4">
      {/* Input — just press Enter to add */}
      <form onSubmit={handleAddSource} className="flex items-center gap-2">
        <Input
          type="url"
          value={newSourceUrl}
          onChange={(e) => setNewSourceUrl(e.target.value)}
          placeholder="Paste RSS feed URL..."
          disabled={isAdding}
          className="flex-1 h-9 text-sm"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={isAdding || !newSourceUrl.trim()}
          className="h-9 pr-2 cursor-pointer"
        >
          {isAdding ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              Accept <Kbd>⏎</Kbd>
            </>
          )}
        </Button>
      </form>

      {/* Table */}
      {isLoading ? (
        <div className="rounded-md border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0"
            >
              <Skeleton className="h-4 w-4 rounded-sm shrink-0" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-4 w-28 ml-auto" />
            </div>
          ))}
        </div>
      ) : sources.length === 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[40px]">
                  <Checkbox disabled />
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Feed</TableHead>
                <TableHead className="text-right">Added</TableHead>
              </TableRow>
            </TableHeader>
          </Table>
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">No feeds added yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Paste an RSS feed URL above and press Enter.
            </p>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-muted-foreground">
            <span>0 of 0 feed(s) selected.</span>
          </div>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Feed</TableHead>
                <TableHead className="hidden md:table-cell">Domain</TableHead>
                <TableHead className="text-right">Added</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {sources.map((source) => (
                <TableRow
                  key={source.id}
                  className="cursor-pointer"
                  data-state={
                    selected.has(source.id) ? "selected" : undefined
                  }
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('[role="checkbox"]')) return;
                    setDetailSource(source);
                    setDetailOpen(true);
                  }}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(source.id)}
                      onCheckedChange={() => toggleSelect(source.id)}
                    />
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant={source.isActive ? "default" : "secondary"}
                      className={
                        source.isActive
                          ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/15"
                          : ""
                      }
                    >
                      {source.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>

                  <TableCell className="font-medium">{source.name}</TableCell>

                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {getDomain(source.url)}
                  </TableCell>

                  <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(source.createdAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Footer — outside table, like the reference design */}
          <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-muted-foreground">
            <span>
              {selected.size} of {sources.length} feed(s) selected.
            </span>
            {selected.size > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs cursor-pointer"
                  >
                    Actions
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleBulkToggle(true)}>
                    Activate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkToggle(false)}>
                    Deactivate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleBulkDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{detailSource?.name}</DialogTitle>
            <DialogDescription>RSS Feed Details</DialogDescription>
          </DialogHeader>
          {detailSource && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Feed URL</span>
                <p className="font-mono text-xs mt-0.5 break-all">
                  {detailSource.url}
                </p>
              </div>
              <div className="flex gap-6">
                <div>
                  <span className="text-xs text-muted-foreground">
                    Category
                  </span>
                  <div className="mt-1">
                    <Badge variant="secondary">
                      {detailSource.category || "General"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Status</span>
                  <div className="mt-1">
                    <Badge
                      variant={
                        detailSource.isActive ? "default" : "secondary"
                      }
                      className={
                        detailSource.isActive
                          ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20"
                          : ""
                      }
                    >
                      {detailSource.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Added</span>
                <p className="text-xs mt-0.5">
                  {new Date(detailSource.createdAt).toLocaleDateString(
                    "en-US",
                    { year: "numeric", month: "long", day: "numeric" }
                  )}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" asChild>
              <a
                href={detailSource?.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Open Feed
              </a>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (detailSource) {
                  const original = [...sources];
                  setSources((prev) =>
                    prev.filter((s) => s.id !== detailSource.id)
                  );
                  setSelected((prev) => {
                    const next = new Set(prev);
                    next.delete(detailSource.id);
                    return next;
                  });
                  setDetailOpen(false);
                  fetch("/api/sources", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: detailSource.id }),
                  })
                    .then((res) => {
                      if (!res.ok) throw new Error();
                      toast.success(`${detailSource.name} removed`);
                    })
                    .catch(() => {
                      setSources(original);
                      toast.error("Failed to delete source");
                    });
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
