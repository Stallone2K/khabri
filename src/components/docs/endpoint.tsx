const methodColors: Record<string, string> = {
  GET: "bg-green-500/15 text-green-400 border-green-500/30",
  POST: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  PUT: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  PATCH: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  DELETE: "bg-red-500/15 text-red-400 border-red-500/30",
};

export function Endpoint({ method, path }: { method: string; path: string }) {
  const colors = methodColors[method] || "bg-muted text-foreground border-border";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 my-6">
      <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold font-mono ${colors}`}>
        {method}
      </span>
      <code className="text-sm font-mono text-foreground">{path}</code>
    </div>
  );
}
