interface ResponseExampleProps {
  status: number;
  description?: string;
  children: React.ReactNode;
}

const statusColors: Record<number, string> = {
  200: "text-green-400",
  201: "text-green-400",
  400: "text-amber-400",
  401: "text-amber-400",
  403: "text-amber-400",
  404: "text-amber-400",
  429: "text-amber-400",
  500: "text-red-400",
};

export function ResponseExample({ status, description, children }: ResponseExampleProps) {
  const color = statusColors[status] || "text-muted-foreground";

  return (
    <div className="my-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-sm font-mono font-bold ${color}`}>{status}</span>
        {description && <span className="text-sm text-muted-foreground">{description}</span>}
      </div>
      {children}
    </div>
  );
}
