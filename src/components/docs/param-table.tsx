interface Param {
  name: string;
  type: string;
  required?: boolean;
  default?: string;
  description: string;
  enum?: string[];
}

export function ParamTable({ params = [] }: { params?: Param[] }) {
  if (!params || params.length === 0) return null;
  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Name</th>
            <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Type</th>
            <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Required</th>
            <th className="text-left py-2 font-medium text-muted-foreground">Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((param) => (
            <tr key={param.name} className="border-b border-border/50">
              <td className="py-2.5 pr-4">
                <code className="text-xs font-mono bg-muted rounded px-1.5 py-0.5">{param.name}</code>
              </td>
              <td className="py-2.5 pr-4 text-muted-foreground text-xs font-mono">{param.type}</td>
              <td className="py-2.5 pr-4 text-xs">
                {param.required ? (
                  <span className="text-amber-400">required</span>
                ) : (
                  <span className="text-muted-foreground">
                    optional{param.default ? ` (${param.default})` : ""}
                  </span>
                )}
              </td>
              <td className="py-2.5 text-muted-foreground text-xs">
                {param.description}
                {param.enum && (
                  <span className="block mt-1">
                    Values: {param.enum.map((v) => (
                      <code key={v} className="text-xs bg-muted rounded px-1 py-0.5 mr-1">{v}</code>
                    ))}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
