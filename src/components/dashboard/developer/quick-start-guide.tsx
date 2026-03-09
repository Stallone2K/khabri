"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, ExternalLink } from "lucide-react";
import Link from "next/link";

const EXAMPLES = [
  {
    title: "List Trends",
    description: "Get the latest ranked trends",
    curl: `curl -H "Authorization: Bearer khabri_YOUR_KEY" \\
  "https://khabri.stallone.co.in/api/v1/trends?page=1&page_size=10"`,
    javascript: `const response = await fetch("https://khabri.stallone.co.in/api/v1/trends", {
  headers: { "Authorization": "Bearer khabri_YOUR_KEY" }
});
const { data, meta } = await response.json();
console.log(data); // Array of ranked trends`,
    python: `import requests

headers = {"Authorization": "Bearer khabri_YOUR_KEY"}
response = requests.get("https://khabri.stallone.co.in/api/v1/trends", headers=headers)
trends = response.json()["data"]
print(f"Found {len(trends)} trends")`,
  },
  {
    title: "Search Signals",
    description: "Search signals by entity or keyword",
    curl: `curl -H "Authorization: Bearer khabri_YOUR_KEY" \\
  "https://khabri.stallone.co.in/api/v1/signals/search?entity=Tesla&entity_type=COMPANY"`,
    javascript: `const params = new URLSearchParams({ entity: "Tesla", entity_type: "COMPANY" });
const response = await fetch(\`https://khabri.stallone.co.in/api/v1/signals/search?\${params}\`, {
  headers: { "Authorization": "Bearer khabri_YOUR_KEY" }
});
const { data } = await response.json();
data.forEach(signal => console.log(signal.title));`,
    python: `import requests

headers = {"Authorization": "Bearer khabri_YOUR_KEY"}
params = {"entity": "Tesla", "entity_type": "COMPANY"}
response = requests.get("https://khabri.stallone.co.in/api/v1/signals/search",
                       headers=headers, params=params)
for signal in response.json()["data"]:
    print(signal["title"])`,
  },
  {
    title: "Stream Real-Time Events",
    description: "Subscribe to live events via Server-Sent Events",
    curl: `curl -N -H "Authorization: Bearer khabri_YOUR_KEY" \\
  "https://khabri.stallone.co.in/api/v1/stream?events=trend.new,anomaly.detected"`,
    javascript: `const eventSource = new EventSource(
  "https://khabri.stallone.co.in/api/v1/stream?events=anomaly.detected", {
    headers: { "Authorization": "Bearer khabri_YOUR_KEY" }
  }
);

eventSource.addEventListener("anomaly.detected", (event) => {
  const data = JSON.parse(event.data);
  console.log("Anomaly:", data.data.label, data.data.severity);
});

eventSource.addEventListener("heartbeat", () => {
  console.log("Connection alive");
});`,
    python: `import sseclient
import requests

url = "https://khabri.stallone.co.in/api/v1/stream?events=anomaly.detected"
headers = {"Authorization": "Bearer khabri_YOUR_KEY"}

response = requests.get(url, headers=headers, stream=True)
client = sseclient.SSEClient(response)

for event in client.events():
    if event.event == "anomaly.detected":
        print(f"Anomaly: {event.data}")`,
  },
  {
    title: "Register Webhook",
    description: "Create a webhook to receive event notifications",
    curl: `curl -X POST -H "Authorization: Bearer khabri_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://your-server.com/webhook","events":["trend.new","anomaly.detected"]}' \\
  "https://khabri.stallone.co.in/api/v1/webhooks"`,
    javascript: `const response = await fetch("https://khabri.stallone.co.in/api/v1/webhooks", {
  method: "POST",
  headers: {
    "Authorization": "Bearer khabri_YOUR_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    url: "https://your-server.com/webhook",
    events: ["trend.new", "anomaly.detected"]
  })
});
const { data } = await response.json();
// IMPORTANT: Save data.secret — it's shown only once
console.log("Webhook secret:", data.secret);`,
    python: `import requests

headers = {
    "Authorization": "Bearer khabri_YOUR_KEY",
    "Content-Type": "application/json"
}
body = {
    "url": "https://your-server.com/webhook",
    "events": ["trend.new", "anomaly.detected"]
}
response = requests.post("https://khabri.stallone.co.in/api/v1/webhooks",
                        headers=headers, json=body)
data = response.json()["data"]
# IMPORTANT: Save data["secret"] — it's shown only once
print(f"Webhook secret: {data['secret']}")`,
  },
];

type Lang = "curl" | "javascript" | "python";

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="rounded-lg bg-muted p-4 overflow-x-auto text-sm font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
      <Button
        size="sm"
        variant="ghost"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2"
        onClick={copy}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  );
}

export function QuickStartGuide() {
  const [lang, setLang] = useState<Lang>("curl");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(["curl", "javascript", "python"] as Lang[]).map((l) => (
            <Badge
              key={l}
              variant={lang === l ? "default" : "outline"}
              className="cursor-pointer select-none"
              onClick={() => setLang(l)}
            >
              {l === "javascript" ? "JavaScript" : l === "python" ? "Python" : "cURL"}
            </Badge>
          ))}
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/docs">
            <ExternalLink className="mr-2 h-3 w-3" />
            Full API Docs
          </Link>
        </Button>
      </div>

      {EXAMPLES.map((example) => (
        <Card key={example.title}>
          <CardHeader>
            <CardTitle className="text-base">{example.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{example.description}</p>
          </CardHeader>
          <CardContent>
            <CodeBlock code={example[lang]} lang={lang} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
