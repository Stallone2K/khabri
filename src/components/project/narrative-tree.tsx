"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  RotateCw,
  Plus,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Check,
  X,
  Info,
  BarChart3,
  FolderDown,
  FileJson,
  FileText,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { NarrativeTimeline } from "@/components/project/narrative-timeline";

// --- TYPES ---

interface NarrativeEvent {
  id: string;
  title: string;
  summary: string | null;
  sourceUrl: string | null;
  impactScore: number;
  sentiment: string | null;
  createdAt: string;
}

interface NarrativeStakeholder {
  id: string;
  name: string;
  type: string;
  role: string | null;
  sentiment: number | null;
  mentionCount: number;
}

interface NarrativeNodeData {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  summary: string | null;
  keywords: string[];
  status: string;
  signalCount: number;
  lastSignalAt: string | null;
  arcPhase: string | null;
  createdAt: string;
  updatedAt: string;
  events: NarrativeEvent[];
  stakeholders: NarrativeStakeholder[];
  children: NarrativeNodeData[];
}

interface NarrativeTreeViewProps {
  project: {
    id: string;
    title: string;
    status: string;
  };
}

/** Recursively sum signalCount for a node and all its descendants. */
function totalSignalCount(node: NarrativeNodeData): number {
  let total = node.signalCount;
  for (const child of node.children || []) {
    total += totalSignalCount(child);
  }
  return total;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function NarrativeTreeView({ project }: NarrativeTreeViewProps) {
  const router = useRouter();
  const [tree, setTree] = useState<NarrativeNodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTitle, setAddTitle] = useState("");

  // Editable project title
  const [projectTitle, setProjectTitle] = useState(project.title);
  const [editingTitle, setEditingTitle] = useState(false);

  const fetchTree = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/narratives`);
      if (!res.ok) {
        setTree(null);
        return;
      }
      const data = await res.json();
      setTree(data.root || null);
    } catch {
      setTree(null);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const handleDiscover = async () => {
    if (projectTitle === "New Tracked Trend") {
      toast.error("Please Set A Topic Name First");
      setEditingTitle(true);
      return;
    }
    setDiscovering(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/discover`, {
        method: "POST",
      });
      const text = await res.text();
      if (!text) throw new Error("Empty response from server");
      const data = JSON.parse(text);
      if (!res.ok) throw new Error(data.details || data.error || "Failed");
      toast.success(`Discovered ${data.discovered} Narratives`);
      await fetchTree();
    } catch (e: any) {
      toast.error("Discovery Failed", { description: e.message });
    } finally {
      setDiscovering(false);
    }
  };

  const handleAddNarrative = async () => {
    if (!addTitle.trim()) return;
    try {
      const res = await fetch(`/api/projects/${project.id}/narratives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: addTitle.trim() }),
      });
      if (!res.ok) throw new Error("Failed to add");
      toast.success("Narrative Added");
      setAddTitle("");
      setShowAddForm(false);
      await fetchTree();
    } catch {
      toast.error("Failed To Add Narrative");
    }
  };

  const handleDeleteNode = async (nodeId: string) => {
    try {
      const res = await fetch(
        `/api/projects/${project.id}/narratives/${nodeId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed");
      toast.success("Narrative Deleted");
      await fetchTree();
    } catch {
      toast.error("Failed To Delete");
    }
  };

  const handleUpdateStatus = async (nodeId: string, status: string) => {
    try {
      const res = await fetch(
        `/api/projects/${project.id}/narratives/${nodeId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (!res.ok) throw new Error("Failed");
      await fetchTree();
    } catch {
      toast.error("Failed To Update Status");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* HEADER */}
      <div className="h-14 shrink-0 flex items-center justify-between px-6 border-b bg-background sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1
            ref={(el) => {
              if (el && editingTitle) el.focus();
            }}
            className="text-base font-semibold cursor-text outline-none hover:text-primary transition-colors"
            contentEditable
            suppressContentEditableWarning
            onFocus={() => setEditingTitle(true)}
            onBlur={(e) => {
              setEditingTitle(false);
              const trimmed = (e.currentTarget.textContent || "").trim();
              if (trimmed && trimmed !== projectTitle) {
                (async () => {
                  try {
                    const res = await fetch(`/api/projects/${project.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ title: trimmed }),
                    });
                    if (!res.ok) throw new Error("Failed");
                    setProjectTitle(trimmed);
                    window.dispatchEvent(new Event("project-created"));
                  } catch {
                    toast.error("Failed To Rename");
                    e.currentTarget.textContent = projectTitle;
                  }
                })();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLElement).blur();
              }
              if (e.key === "Escape") {
                (e.target as HTMLElement).textContent = projectTitle;
                (e.target as HTMLElement).blur();
              }
            }}
          >
            {projectTitle}
          </h1>
          <Badge
            variant="outline"
            className="text-[10px] h-4 px-1.5 font-normal uppercase"
          >
            {project.status}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          {tree?.updatedAt && (
            <span className="text-[11px] text-muted-foreground">
              Last Updated: {new Date(tree.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}{" "}
              {new Date(tree.updatedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={handleDiscover}
            disabled={discovering}
          >
            {discovering ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <RotateCw className="h-3.5 w-3.5 mr-1" />
            )}
            {discovering ? "Discovering…" : "Discover"}
          </Button>
          {tree && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <FolderDown className="h-5.5 w-5.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => window.open(`/api/projects/${project.id}/export?format=json`, "_blank")}>
                  <FileJson className="mr-2 h-3.5 w-3.5" /> Export JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.open(`/api/projects/${project.id}/export?format=markdown`, "_blank")}>
                  <FileText className="mr-2 h-3.5 w-3.5" /> Export Markdown
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full scrollbar-hide" style={{ scrollbarWidth: "none" }}>
        {loading || discovering ? (
          /* SKELETON STATE */
          <div className="space-y-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-muted" />
              <div className="h-5 w-64 rounded bg-muted" />
              <div className="h-4 w-14 rounded-full bg-muted" />
            </div>
            <div className="ml-6 space-y-3">
              <div className="h-3 w-full max-w-md rounded bg-muted/60" />
              <div className="h-3 w-48 rounded bg-muted/60" />
            </div>
            <div className="mt-6 ml-8 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-muted" />
                    <div className="h-4 rounded bg-muted" style={{ width: `${180 + i * 40}px` }} />
                    <div className="h-3.5 w-12 rounded-full bg-muted" />
                  </div>
                  <div className="ml-6 space-y-2">
                    <div className="h-3 w-full max-w-sm rounded bg-muted/50" />
                    <div className="h-3 w-32 rounded bg-muted/40" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : !tree ? (
          /* EMPTY — just blank */
          null
        ) : (
          /* TREE VIEW */
          <div className="space-y-1">
            {/* ADD FORM (inline) */}
            {showAddForm && (
              <div className="flex items-center gap-2 mb-4 pl-[88px]">
                <Input
                  placeholder="New narrative title..."
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  className="h-8 text-sm flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddNarrative();
                    if (e.key === "Escape") {
                      setShowAddForm(false);
                      setAddTitle("");
                    }
                  }}
                />
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleAddNarrative}
                  disabled={!addTitle.trim()}
                >
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={() => {
                    setShowAddForm(false);
                    setAddTitle("");
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* ROOT NODE */}
            <RootNodeRow node={tree} />

            {/* CHILD NARRATIVES */}
            {tree.children.length > 0 ? (
              <div className="relative ml-4">
                {tree.children.map((child, i) => (
                  <NarrativeRow
                    key={child.id}
                    node={child}
                    depth={0}
                    isLast={i === tree.children.length - 1}
                    onDelete={handleDeleteNode}
                    onStatusChange={handleUpdateStatus}
                    projectId={project.id}
                    onRefresh={fetchTree}
                  />
                ))}
              </div>
            ) : (
              <div className="pl-[88px] ml-3 border-l border-muted py-3">
                <p className="text-sm text-muted-foreground pl-4">
                  No sub-narratives yet. Click &quot;Discover&quot; or &quot;Add&quot;.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// ROOT NODE ROW
// =============================================================================

function RootNodeRow({ node }: { node: NarrativeNodeData }) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div>
      <div className="flex items-baseline gap-4 py-3 group">
        <span className="text-[11px] text-muted-foreground w-[72px] shrink-0 text-right tabular-nums">
          {formatDate(node.createdAt)}
        </span>
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
          <h2 className="text-base font-semibold truncate">{titleCase(node.title)}</h2>
          <StatusBadge status={node.status} />
          <span className="text-[11px] text-muted-foreground shrink-0">
            {totalSignalCount(node)} signals
          </span>
          {(node.summary || node.stakeholders?.length > 0) && (
            <button
              onClick={() => setShowInfo(!showInfo)}
              title="Get Info"
              className={`ml-1 rounded-full p-1 transition-colors ${showInfo ? "text-primary bg-primary/10" : "text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-muted"}`}
            >
              <Info className="h-4 w-4" />
            </button>
          )}
          {node.arcPhase && (
            <ArcPhaseBadge phase={node.arcPhase} />
          )}
        </div>
      </div>
      {showInfo && (
        <div className="ml-[92px] pl-4 pb-2 text-xs text-muted-foreground leading-relaxed max-w-lg">
          {node.summary && titleCase(cleanSummary(node.summary))}
          {node.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {node.keywords.map((kw) => (
                <span key={kw} className="text-[10px] px-1.5 py-0.5 rounded bg-muted">
                  {titleCase(kw)}
                </span>
              ))}
            </div>
          )}
          {node.stakeholders?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {node.stakeholders.map((s) => (
                <StakeholderPill key={s.id} stakeholder={s} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// NARRATIVE ROW (child node — text-based)
// =============================================================================

function NarrativeRow({
  node,
  depth,
  isLast,
  onDelete,
  onStatusChange,
  projectId,
  onRefresh,
}: {
  node: NarrativeNodeData;
  depth: number;
  isLast: boolean;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  projectId: string;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(node.title);
  const [addingChild, setAddingChild] = useState(false);
  const [childTitle, setChildTitle] = useState("");

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/narratives/${node.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: editTitle.trim() }),
        },
      );
      if (!res.ok) throw new Error("Failed");
      setEditing(false);
      onRefresh();
    } catch {
      toast.error("Failed To Save");
    }
  };

  const handleAddChild = async () => {
    if (!childTitle.trim()) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/narratives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: childTitle.trim(), parentId: node.id }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Sub-Narrative Added");
      setChildTitle("");
      setAddingChild(false);
      onRefresh();
    } catch {
      toast.error("Failed To Add Sub-Narrative");
    }
  };

  // Font + dot sizing per depth: 0 = normal, 1 = smaller, 2+ = smallest
  const textSize = depth === 0 ? "text-sm" : depth === 1 ? "text-[13px]" : "text-xs";
  const dotSize = depth === 0 ? "h-2 w-2" : depth === 1 ? "h-1.5 w-1.5" : "h-1.5 w-1.5";
  const lineOffset = depth === 0 ? "left-[4px]" : "left-[3px]";
  const dateSize = depth === 0 ? "text-[11px]" : "text-[10px]";
  const rowPad = depth === 0 ? "py-2" : "py-1.5";

  return (
    <div className="group">
      <div className={`flex items-baseline gap-4 ${rowPad}`}>
        {/* DATE */}
        <span className={`${dateSize} text-muted-foreground w-[72px] shrink-0 text-right tabular-nums`}>
          {formatDate(node.createdAt)}
        </span>

        {/* TREE CONNECTOR */}
        <div className="relative flex items-center self-stretch">
          <div
            className={`absolute ${lineOffset} top-0 w-px bg-muted ${isLast ? "h-1/2" : "h-full"}`}
          />
          <div className={`${dotSize} rounded-full bg-muted-foreground/40 shrink-0 relative z-10`} />
        </div>

        {/* CONTENT */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-1 flex-1">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="h-7 text-sm flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEdit();
                  if (e.key === "Escape") {
                    setEditing(false);
                    setEditTitle(node.title);
                  }
                }}
              />
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveEdit}>
                <Check className="h-3.5 w-3.5 text-green-500" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => {
                  setEditing(false);
                  setEditTitle(node.title);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <>
              {/* Expand toggle for events */}
              {node.events.length > 0 ? (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1 hover:opacity-80"
                >
                  {expanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                </button>
              ) : null}

              <span
                className={`${textSize} truncate ${
                  node.status === "DORMANT"
                    ? "text-muted-foreground line-through"
                    : node.status === "RESOLVED"
                      ? "text-muted-foreground"
                      : "text-foreground"
                }`}
              >
                {titleCase(node.title)}
              </span>

              <StatusBadge status={node.status} />

              {totalSignalCount(node) > 0 && (
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {totalSignalCount(node)} signals
                </span>
              )}

              {(node.summary || node.stakeholders?.length > 0) && (
                <button
                  onClick={() => setShowInfo(!showInfo)}
                  title="Get Info"
                  className={`rounded-full p-1 transition-colors ${showInfo ? "text-primary bg-primary/10" : "text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-muted"}`}
                >
                  <Info className="h-4 w-4" />
                </button>
              )}

              {node.arcPhase && (
                <ArcPhaseBadge phase={node.arcPhase} />
              )}

              {/* ACTIONS (show on hover) */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center shrink-0 ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem onClick={() => setEditing(true)}>
                      <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                    </DropdownMenuItem>
                    {node.status === "ACTIVE" && (
                      <DropdownMenuItem onClick={() => onStatusChange(node.id, "DORMANT")}>
                        <EyeOff className="mr-2 h-3.5 w-3.5" /> Dormant
                      </DropdownMenuItem>
                    )}
                    {node.status === "DORMANT" && (
                      <DropdownMenuItem onClick={() => onStatusChange(node.id, "ACTIVE")}>
                        <Eye className="mr-2 h-3.5 w-3.5" /> Reactivate
                      </DropdownMenuItem>
                    )}
                    {node.status !== "RESOLVED" && (
                      <DropdownMenuItem onClick={() => onStatusChange(node.id, "RESOLVED")}>
                        <Check className="mr-2 h-3.5 w-3.5" /> Resolve
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setAddingChild(true)}>
                      <Plus className="mr-2 h-3.5 w-3.5" /> Add Sub-Narrative
                    </DropdownMenuItem>
                    {totalSignalCount(node) > 0 && (
                      <DropdownMenuItem onClick={() => setShowTimeline(!showTimeline)}>
                        <BarChart3 className="mr-2 h-3.5 w-3.5" /> {showTimeline ? "Hide Timeline" : "Timeline"}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-500 focus:text-red-500"
                      onClick={() => onDelete(node.id)}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          )}
        </div>
      </div>

      {/* INFO PANEL */}
      {showInfo && (
        <div className="ml-[104px] pb-2 text-xs text-muted-foreground leading-relaxed max-w-lg">
          {node.summary && titleCase(cleanSummary(node.summary))}
          {node.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {node.keywords.map((kw) => (
                <span key={kw} className="text-[10px] px-1.5 py-0.5 rounded bg-muted">
                  {titleCase(kw)}
                </span>
              ))}
            </div>
          )}
          {node.stakeholders?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {node.stakeholders.map((s) => (
                <StakeholderPill key={s.id} stakeholder={s} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* EVENTS (expanded) */}
      {expanded && node.events.length > 0 && (
        <div className="ml-[88px] pl-7 border-l border-muted/50 ml-[92px] space-y-1 pb-1">
          {node.events.map((event) => (
            <div key={event.id} className="flex items-baseline gap-3 py-0.5">
              <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                {formatDate(event.createdAt)}
              </span>
              <div
                className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${
                  event.sentiment === "NEGATIVE"
                    ? "bg-red-500"
                    : event.sentiment === "POSITIVE"
                      ? "bg-green-500"
                      : "bg-zinc-500"
                }`}
              />
              <span className="text-xs text-muted-foreground truncate">
                {event.title}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* TIMELINE */}
      {showTimeline && (
        <div className="ml-[104px] pb-2 max-w-lg">
          <NarrativeTimeline projectId={projectId} nodeId={node.id} />
        </div>
      )}

      {/* ADD SUB-NARRATIVE (inline) */}
      {addingChild && (
        <div className="flex items-center gap-2 ml-[104px] py-1.5">
          <Input
            placeholder="Sub-narrative title..."
            value={childTitle}
            onChange={(e) => setChildTitle(e.target.value)}
            className="h-7 text-xs flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddChild();
              if (e.key === "Escape") {
                setAddingChild(false);
                setChildTitle("");
              }
            }}
          />
          <Button size="sm" className="h-7 text-xs px-2" onClick={handleAddChild} disabled={!childTitle.trim()}>
            Add
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs px-1" onClick={() => { setAddingChild(false); setChildTitle(""); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Recursive children */}
      {node.children.length > 0 && (
        <div className="ml-[96px] pl-5 border-l border-muted/60">
          {node.children.map((child, i) => (
            <NarrativeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              isLast={i === node.children.length - 1}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
              projectId={projectId}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SHARED
// =============================================================================

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "text-green-500 border-green-500/40 bg-green-500/10",
    DORMANT: "text-zinc-400 border-zinc-400/40 bg-zinc-400/10",
    RESOLVED: "text-blue-500 border-blue-500/40 bg-blue-500/10",
  };
  const labels: Record<string, string> = {
    ACTIVE: "Active",
    DORMANT: "Dormant",
    RESOLVED: "Resolved",
  };
  return (
    <Badge
      variant="outline"
      className={`text-[10px] px-1.5 py-0 shrink-0 ${styles[status] || "text-zinc-500 border-zinc-500/30"}`}
    >
      {labels[status] || status}
    </Badge>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHrs = diffMs / 3600000;

  if (diffHrs < 24) {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }
  if (diffHrs < 168) {
    return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Title Case every word */
function titleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Strip lazy AI prefixes like "This narrative examines..." */
function cleanSummary(raw: string): string {
  const stripped = raw
    .replace(/^this narrative (?:examines|explores|focuses on|tracks|covers|analyzes|investigates|looks at|delves into|highlights)\s*/i, "")
    .replace(/^this (?:sub-trend|angle|thread) (?:examines|explores|focuses on|tracks|covers|analyzes)\s*/i, "");
  // Capitalize first letter after stripping
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

function StakeholderPill({ stakeholder }: { stakeholder: NarrativeStakeholder }) {
  const typeColors: Record<string, string> = {
    PERSON: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    ORG: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    COMPANY: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    COUNTRY: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${typeColors[stakeholder.type] || "bg-muted text-muted-foreground border-muted"}`}
      title={`${stakeholder.type} · ${stakeholder.mentionCount} mentions`}
    >
      {stakeholder.name}
      {stakeholder.mentionCount > 1 && (
        <span className="text-[9px] opacity-60">×{stakeholder.mentionCount}</span>
      )}
    </span>
  );
}

function ArcPhaseBadge({ phase }: { phase: string }) {
  const phaseStyles: Record<string, string> = {
    EMERGENCE: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
    ESCALATION: "text-orange-400 border-orange-500/30 bg-orange-500/10",
    PEAK: "text-red-400 border-red-500/30 bg-red-500/10",
    RESOLUTION: "text-green-400 border-green-500/30 bg-green-500/10",
  };
  return (
    <Badge
      variant="outline"
      className={`text-[9px] px-1.5 py-0 shrink-0 ${phaseStyles[phase] || "text-zinc-400 border-zinc-500/30"}`}
    >
      {phase}
    </Badge>
  );
}
