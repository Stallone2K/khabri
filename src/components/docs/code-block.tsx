import { codeToHtml } from "shiki";
import { CopyButton } from "./copy-button";

interface CodeBlockProps {
  code: string;
  lang?: string;
  title?: string;
}

export async function CodeBlock({ code = "", lang = "text", title }: CodeBlockProps) {
  const safeCode = typeof code === "string" ? code.trim() : String(code || "");
  const html = await codeToHtml(safeCode, {
    lang,
    theme: "github-dark",
  });

  return (
    <div className="group relative my-4 rounded-lg border border-border overflow-hidden bg-[hsl(0,0%,6%)]">
      {title && (
        <div className="flex items-center border-b border-border px-4 py-2 text-xs text-muted-foreground font-mono">
          {title}
        </div>
      )}
      <CopyButton code={safeCode} />
      <div
        className="overflow-x-auto p-4 text-sm [&_pre]:!bg-transparent [&_pre]:!m-0 [&_code]:!bg-transparent"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
