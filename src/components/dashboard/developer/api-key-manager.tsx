"use client";

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, Check, MoreVertical, Trash2, KeyRound } from "lucide-react";
import { toast } from "sonner";

const ALL_SCOPES = ["trends", "signals", "anomalies", "narratives", "geo", "analytics", "webhooks"];
const DEFAULT_RATE_LIMIT = 500;

export interface ApiKeyManagerHandle {
  openCreate: () => void;
}

interface ApiKeyInfo {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  rateLimit: number;
  requestCount: number;
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export const ApiKeyManager = forwardRef<ApiKeyManagerHandle>(function ApiKeyManager(_props, ref) {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKeyRaw, setNewKeyRaw] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");

  useImperativeHandle(ref, () => ({
    openCreate: () => setShowCreate(true),
  }));

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/keys");
      if (res.ok) {
        const data = await res.json();
        setKeys((data.keys || []).filter((k: ApiKeyInfo) => k.isActive));
      }
    } catch {
      toast.error("Failed to fetch API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Key name is required");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), scopes: ALL_SCOPES, rateLimit: DEFAULT_RATE_LIMIT }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create key");
        return;
      }
      const rawKey = data.rawKey;
      setShowCreate(false);
      setName("");
      fetchKeys();
      toast.success("API key created");
      setTimeout(() => setNewKeyRaw(rawKey), 200);
    } catch {
      toast.error("Failed to create key");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== id));
        toast.success("API key deleted");
      } else {
        toast.error("Failed to delete key");
      }
    } catch {
      toast.error("Failed to delete key");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) setName(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Enter A Name To Identify This Key.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="key-name">Name</Label>
            <Input
              id="key-name"
              placeholder="e.g., Production Backend"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !creating) handleCreate(); }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Creating..." : "Create Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New key dialog */}
      <Dialog open={!!newKeyRaw} onOpenChange={(open) => { if (!open) setNewKeyRaw(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Your API Key</DialogTitle>
            <DialogDescription>
              Copy your key now. You won{"'"}t be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border border-border/50 bg-muted/50 px-3 py-2 font-mono text-sm break-all select-all">
              {newKeyRaw}
            </code>
            <Button
              size="icon"
              variant="ghost"
              className="shrink-0 hover:bg-transparent"
              onClick={() => newKeyRaw && copyToClipboard(newKeyRaw)}
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewKeyRaw(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Keys table */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading keys...</div>
      ) : keys.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center text-muted-foreground min-h-[calc(100vh-12rem)]">
          <KeyRound className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">No API keys yet</p>
          <p className="text-xs mt-1 text-muted-foreground/70">Create a key to start using the API</p>
        </div>
      ) : keys.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="text-muted-foreground font-medium">Key</TableHead>
              <TableHead className="text-muted-foreground font-medium">Created</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.map((key) => (
              <TableRow key={key.id} className="border-border/50">
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-sm text-blue-400">
                      ...{key.prefix.slice(-8)}
                    </span>
                    <span className="text-xs text-muted-foreground">{key.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(key.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(key.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete key
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  );
});
