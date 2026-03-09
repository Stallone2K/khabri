import { Info, AlertTriangle, AlertCircle } from "lucide-react";

const variants = {
  info: {
    border: "border-blue-500/30",
    bg: "bg-blue-500/5",
    icon: Info,
    iconColor: "text-blue-400",
  },
  warning: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    icon: AlertTriangle,
    iconColor: "text-amber-400",
  },
  danger: {
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    icon: AlertCircle,
    iconColor: "text-red-400",
  },
};

export function Callout({
  type = "info",
  children,
}: {
  type?: "info" | "warning" | "danger";
  children: React.ReactNode;
}) {
  const v = variants[type];

  return (
    <div className={`my-4 flex gap-3 rounded-lg border ${v.border} ${v.bg} p-4`}>
      <v.icon className={`h-5 w-5 shrink-0 mt-0.5 ${v.iconColor}`} />
      <div className="text-sm text-muted-foreground [&_p]:m-0">{children}</div>
    </div>
  );
}
