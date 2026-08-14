"use client";

import { useState, useEffect } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Loader2 } from "lucide-react";

interface ArcDataPoint {
  date: string;
  eventCount: number;
  avgSentiment: number;
  peakImpact: number;
}

interface NarrativeTimelineProps {
  projectId: string;
  nodeId: string;
}

export function NarrativeTimeline({ projectId, nodeId }: NarrativeTimelineProps) {
  const [data, setData] = useState<ArcDataPoint[]>([]);
  const [phase, setPhase] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/narratives/${nodeId}/arc`)
      .then((res) => res.json())
      .then((arc) => {
        setData(arc.dataPoints || []);
        setPhase(arc.phase || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId, nodeId]);

  if (loading) {
    return (
      <div className="h-[160px] flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-[80px] flex items-center justify-center text-xs text-muted-foreground">
        No timeline data yet
      </div>
    );
  }

  // Format dates for display
  const chartData = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  return (
    <div className="space-y-1">
      {phase && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-[10px] text-muted-foreground">Arc Phase:</span>
          <span className="text-[10px] font-medium text-foreground">{phase}</span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14.9%)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "hsl(0 0% 63.9%)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="events"
            tick={{ fontSize: 10, fill: "hsl(0 0% 63.9%)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="sentiment"
            orientation="right"
            domain={[-1, 1]}
            tick={{ fontSize: 10, fill: "hsl(0 0% 63.9%)" }}
            tickLine={false}
            axisLine={false}
            hide
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(0 0% 7%)",
              border: "1px solid hsl(0 0% 14.9%)",
              borderRadius: "6px",
              fontSize: "11px",
            }}
            labelStyle={{ color: "hsl(0 0% 63.9%)" }}
          />
          <Bar
            yAxisId="events"
            dataKey="eventCount"
            fill="hsl(0 0% 30%)"
            radius={[2, 2, 0, 0]}
            name="Events"
          />
          <Line
            yAxisId="sentiment"
            type="monotone"
            dataKey="avgSentiment"
            stroke="hsl(210 100% 60%)"
            strokeWidth={1.5}
            dot={{ r: 2, fill: "hsl(210 100% 60%)" }}
            name="Sentiment"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
