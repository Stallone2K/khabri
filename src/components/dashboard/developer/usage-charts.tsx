"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Activity, AlertCircle, Clock, Key } from "lucide-react";

interface DailyStat {
  date: string;
  requests: number;
  errors: number;
  avgMs: number;
}

interface TopEndpoint {
  endpoint: string;
  count: number;
  avgMs: number;
}

interface UsageData {
  daily: DailyStat[];
  topEndpoints: TopEndpoint[];
  summary: {
    totalRequests: number;
    totalErrors: number;
    errorRate: number;
    avgResponseMs: number;
  };
}

export function UsageCharts() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/keys/usage?days=30")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading usage data...</div>;
  }

  if (!data || data.summary.totalRequests === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No API usage yet. Create an API key and make some requests to see charts here.</p>
      </div>
    );
  }

  const statCards = [
    { label: "Total Requests (30d)", value: data.summary.totalRequests.toLocaleString(), icon: Activity },
    { label: "Error Rate", value: `${data.summary.errorRate}%`, icon: AlertCircle },
    { label: "Avg Response Time", value: `${data.summary.avgResponseMs}ms`, icon: Clock },
    { label: "Total Errors", value: data.summary.totalErrors.toLocaleString(), icon: AlertCircle },
  ];

  return (
    <div className="space-y-6">
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <stat.icon className="h-4 w-4" />
                <span className="text-xs">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily requests chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily API Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14.9%)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "hsl(0 0% 63.9%)", fontSize: 12 }}
                tickFormatter={(v) => {
                  const d = new Date(v);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
              <YAxis tick={{ fill: "hsl(0 0% 63.9%)", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(240 10% 3.9%)",
                  border: "1px solid hsl(240 3.7% 15.9%)",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="requests"
                stroke="hsl(142.1 76.2% 36.3%)"
                strokeWidth={2}
                dot={false}
                name="Requests"
              />
              <Line
                type="monotone"
                dataKey="errors"
                stroke="hsl(0 62.8% 30.6%)"
                strokeWidth={2}
                dot={false}
                name="Errors"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top endpoints */}
      {data.topEndpoints.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Avg Response</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topEndpoints.map((ep) => (
                  <TableRow key={ep.endpoint}>
                    <TableCell className="font-mono text-sm">{ep.endpoint}</TableCell>
                    <TableCell className="text-right">{ep.count.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{ep.avgMs}ms</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
