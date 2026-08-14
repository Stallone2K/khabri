import type { MDXComponents } from "mdx/types";
import { CodeBlock } from "./code-block";
import { Endpoint } from "./endpoint";
import { ParamTable } from "./param-table";
import { ResponseExample } from "./response-example";
import { Callout } from "./callout";
import { RequestExample } from "./request-example";
import GithubSlugger from "github-slugger";

const slugger = new GithubSlugger();

function createHeading(level: 1 | 2 | 3 | 4) {
  const Tag = `h${level}` as const;
  const sizes: Record<number, string> = {
    1: "text-3xl font-bold tracking-tight mt-2 mb-6",
    2: "text-xl font-semibold tracking-tight mt-10 mb-4 border-b border-border pb-2",
    3: "text-lg font-semibold mt-8 mb-3",
    4: "text-base font-semibold mt-6 mb-2",
  };

  return function Heading({ children }: { children?: React.ReactNode }) {
    slugger.reset();
    const text = typeof children === "string" ? children : "";
    const id = slugger.slug(text);

    return (
      <Tag id={id} className={`${sizes[level]} scroll-mt-20 group`}>
        {children}
        <a href={`#${id}`} className="ml-2 opacity-0 group-hover:opacity-100 text-muted-foreground text-sm transition-opacity" aria-label="Link to section">
          #
        </a>
      </Tag>
    );
  };
}

export const mdxComponents: MDXComponents = {
  h1: createHeading(1),
  h2: createHeading(2),
  h3: createHeading(3),
  h4: createHeading(4),
  p: (props) => <p className="text-muted-foreground leading-7 mb-4" {...props} />,
  a: (props) => <a className="text-primary underline underline-offset-4 hover:text-primary/80" {...props} />,
  ul: (props) => <ul className="my-4 ml-6 list-disc text-muted-foreground [&_li]:mt-1" {...props} />,
  ol: (props) => <ol className="my-4 ml-6 list-decimal text-muted-foreground [&_li]:mt-1" {...props} />,
  li: (props) => <li className="leading-7" {...props} />,
  blockquote: (props) => <blockquote className="my-4 border-l-2 border-border pl-4 text-muted-foreground italic" {...props} />,
  hr: () => <hr className="my-8 border-border" />,
  code: (props) => <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-sm text-foreground" {...props} />,
  pre: async (props: React.ComponentPropsWithoutRef<"pre">) => {
    const codeEl = props.children as React.ReactElement<{ className?: string; children?: string }>;
    const code = typeof codeEl?.props?.children === "string" ? codeEl.props.children : "";
    const lang = codeEl?.props?.className?.replace("language-", "") || "text";

    return <CodeBlock code={code} lang={lang} />;
  },
  table: (props) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full text-sm" {...props} />
    </div>
  ),
  thead: (props) => <thead {...props} />,
  tbody: (props) => <tbody {...props} />,
  tr: (props) => <tr className="border-b border-border/50" {...props} />,
  th: (props) => <th className="text-left py-2 pr-4 font-medium text-muted-foreground" {...props} />,
  td: (props) => <td className="py-2 pr-4 text-muted-foreground" {...props} />,
  // Custom components
  Endpoint,
  ParamTable,
  ResponseExample,
  Callout,
  RequestExample,
};
