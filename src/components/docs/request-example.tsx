import { codeToHtml } from "shiki";
import { CodeTabsClient } from "./code-tabs";

interface RequestExampleProps {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  params?: string;
  body?: string;
}

const BASE = "https://khabri.shownomore.com/api";

function generateCurl(method: string, path: string, params?: string, body?: string): string {
  const url = `${BASE}${path}${params ? `?${params}` : ""}`;
  const lines = [];
  if (method !== "GET") lines.push(`curl -X ${method} "${url}" \\`);
  else lines.push(`curl "${url}" \\`);
  lines.push(`  -H "Authorization: Bearer YOUR_API_KEY"`);
  if (body) {
    lines.push(` \\`);
    lines.push(`  -H "Content-Type: application/json" \\`);
    lines.push(`  -d '${body}'`);
  }
  return lines.join("\n");
}

function generatePython(method: string, path: string, params?: string, body?: string): string {
  const lines = ["import requests", ""];
  const url = `${BASE}${path}`;
  const headers = `{"Authorization": "Bearer YOUR_API_KEY"}`;

  if (method === "GET") {
    if (params) {
      const paramObj = Object.fromEntries(new URLSearchParams(params));
      const paramStr = JSON.stringify(paramObj, null, 2).replace(/"/g, '"');
      lines.push(`response = requests.get(`);
      lines.push(`    "${url}",`);
      lines.push(`    params=${paramStr.replace(/"/g, '"')},`);
      lines.push(`    headers=${headers}`);
      lines.push(`)`);
    } else {
      lines.push(`response = requests.get("${url}", headers=${headers})`);
    }
  } else if (method === "POST") {
    lines.push(`response = requests.post(`);
    lines.push(`    "${url}",`);
    if (body) lines.push(`    json=${body},`);
    lines.push(`    headers=${headers}`);
    lines.push(`)`);
  } else if (method === "DELETE") {
    lines.push(`response = requests.delete("${url}", headers=${headers})`);
  } else {
    lines.push(`response = requests.${method.toLowerCase()}("${url}", headers=${headers})`);
  }

  lines.push("", "data = response.json()", 'print(data["data"])');
  return lines.join("\n");
}

function generateJavaScript(method: string, path: string, params?: string, body?: string): string {
  const url = `${BASE}${path}${params ? `?${params}` : ""}`;
  const lines: string[] = [];
  const opts: string[] = [];

  if (method !== "GET") opts.push(`  method: "${method}",`);
  opts.push(`  headers: {`);
  opts.push(`    "Authorization": "Bearer YOUR_API_KEY",`);
  if (body) opts.push(`    "Content-Type": "application/json",`);
  opts.push(`  },`);
  if (body) opts.push(`  body: JSON.stringify(${body}),`);

  lines.push(`const response = await fetch("${url}", {`);
  lines.push(...opts);
  lines.push(`});`);
  lines.push("", "const { data, meta } = await response.json();", "console.log(data);");

  return lines.join("\n");
}

function generateTypeScript(method: string, path: string, params?: string, body?: string): string {
  const url = `${BASE}${path}${params ? `?${params}` : ""}`;
  const lines: string[] = [];
  const opts: string[] = [];

  if (method !== "GET") opts.push(`  method: "${method}",`);
  opts.push(`  headers: {`);
  opts.push(`    "Authorization": "Bearer YOUR_API_KEY",`);
  if (body) opts.push(`    "Content-Type": "application/json",`);
  opts.push(`  },`);
  if (body) opts.push(`  body: JSON.stringify(${body}),`);

  lines.push(`const response: Response = await fetch("${url}", {`);
  lines.push(...opts);
  lines.push(`});`);
  lines.push("");
  lines.push("const json = await response.json();");
  lines.push("");
  lines.push("if (!response.ok) {");
  lines.push("  throw new Error(json.error?.message ?? \"Request failed\");");
  lines.push("}");
  lines.push("");
  lines.push("console.log(json.data);");

  return lines.join("\n");
}

function generateGo(method: string, path: string, params?: string, body?: string): string {
  const url = `${BASE}${path}${params ? `?${params}` : ""}`;
  const lines: string[] = [];

  if (body) {
    lines.push(`body := strings.NewReader(\`${body}\`)`);
    lines.push(`req, err := http.NewRequest("${method}", "${url}", body)`);
  } else {
    lines.push(`req, err := http.NewRequest("${method}", "${url}", nil)`);
  }

  lines.push(`if err != nil {`);
  lines.push(`    log.Fatal(err)`);
  lines.push(`}`);
  lines.push("");
  lines.push(`req.Header.Set("Authorization", "Bearer YOUR_API_KEY")`);
  if (body) lines.push(`req.Header.Set("Content-Type", "application/json")`);
  lines.push("");
  lines.push(`resp, err := http.DefaultClient.Do(req)`);
  lines.push(`if err != nil {`);
  lines.push(`    log.Fatal(err)`);
  lines.push(`}`);
  lines.push(`defer resp.Body.Close()`);
  lines.push("");
  lines.push(`var result map[string]interface{}`);
  lines.push(`json.NewDecoder(resp.Body).Decode(&result)`);
  lines.push(`fmt.Println(result["data"])`);

  return lines.join("\n");
}

const langMap: { key: string; label: string; lang: string; generator: typeof generateCurl }[] = [
  { key: "bash", label: "cURL", lang: "bash", generator: generateCurl },
  { key: "python", label: "Python", lang: "python", generator: generatePython },
  { key: "javascript", label: "JavaScript", lang: "javascript", generator: generateJavaScript },
  { key: "typescript", label: "TypeScript", lang: "typescript", generator: generateTypeScript },
  { key: "go", label: "Go", lang: "go", generator: generateGo },
];

export async function RequestExample({ method, path, params, body }: RequestExampleProps) {
  const tabs = await Promise.all(
    langMap.map(async ({ key, label, lang, generator }) => {
      const code = generator(method, path, params, body);
      let html: string;
      try {
        html = await codeToHtml(code, { lang, theme: "github-dark" });
      } catch {
        html = `<pre><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`;
      }
      return { lang: key, label, code, html };
    })
  );

  return <CodeTabsClient tabs={tabs} />;
}
