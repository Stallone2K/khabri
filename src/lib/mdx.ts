import fs from "fs";
import path from "path";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { mdxComponents } from "@/components/docs/mdx-components";

const CONTENT_DIR = path.join(process.cwd(), "src/content/docs");

export interface DocFrontmatter {
  title: string;
  description?: string;
  method?: string;
  path?: string;
  section?: string;
}

export async function getDocBySlug(slug: string[] = []) {
  const target = slug.length === 0 ? "index" : slug.join("/");
  const filePath = path.join(CONTENT_DIR, target + ".mdx");
  const dirIndex = path.join(CONTENT_DIR, target, "index.mdx");

  let actualPath: string;
  if (fs.existsSync(filePath)) {
    actualPath = filePath;
  } else if (fs.existsSync(dirIndex)) {
    actualPath = dirIndex;
  } else {
    return null;
  }

  const source = fs.readFileSync(actualPath, "utf-8");

  const { content, frontmatter } = await compileMDX<DocFrontmatter>({
    source,
    components: mdxComponents,
    options: {
      parseFrontmatter: true,
      mdxOptions: { remarkPlugins: [remarkGfm] },
    },
  });

  return { content, frontmatter };
}

export function getAllDocSlugs(): string[][] {
  const slugs: string[][] = [];

  function walk(dir: string, prefix: string[] = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), [...prefix, entry.name]);
      } else if (entry.name.endsWith(".mdx")) {
        const name = entry.name.replace(".mdx", "");
        if (name === "index") {
          slugs.push(prefix);
        } else {
          slugs.push([...prefix, name]);
        }
      }
    }
  }

  if (fs.existsSync(CONTENT_DIR)) {
    walk(CONTENT_DIR);
  }

  return slugs;
}
