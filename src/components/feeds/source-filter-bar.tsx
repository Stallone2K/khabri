"use client";

type Source = {
  id: string;
  name: string;
};

export function SourceFilterBar({
  sources,
  activeSourceId,
  onSelect,
}: {
  sources: Source[];
  activeSourceId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      <button
        onClick={() => onSelect(null)}
        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
          activeSourceId === null
            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
            : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
        }`}
      >
        All
      </button>
      {sources.map((source) => (
        <button
          key={source.id}
          onClick={() => onSelect(source.id)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
            activeSourceId === source.id
              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
              : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
          }`}
        >
          {source.name}
        </button>
      ))}
    </div>
  );
}
