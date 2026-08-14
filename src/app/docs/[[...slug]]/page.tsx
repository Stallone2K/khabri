import { notFound } from "next/navigation";
import { getDocBySlug, getAllDocSlugs } from "@/lib/mdx";
import { findNavNeighbors } from "@/lib/docs-nav";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

export async function generateStaticParams() {
  const slugs = getAllDocSlugs();
  return [{ slug: undefined }, ...slugs.map((slug) => ({ slug }))];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = await getDocBySlug(slug || []);
  if (!doc) return {};

  return {
    title: `${doc.frontmatter.title} | Khabri API Docs`,
    description: doc.frontmatter.description,
  };
}

export default async function DocsPage({ params }: PageProps) {
  const { slug } = await params;
  const doc = await getDocBySlug(slug || []);

  if (!doc) {
    notFound();
  }

  const href = slug ? `/docs/${slug.join("/")}` : "/docs";
  const { prev, next } = findNavNeighbors(href);

  return (
    <article>
      {doc.frontmatter.description && (
        <p className="text-muted-foreground text-lg mb-6">{doc.frontmatter.description}</p>
      )}
      <div className="docs-content">{doc.content}</div>
      {(prev || next) && (
        <div className="flex items-center justify-between mt-16 pt-6 border-t border-border">
          {prev ? (
            <Link
              href={prev.href}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              {prev.title}
            </Link>
          ) : (
            <div />
          )}
          {next ? (
            <Link
              href={next.href}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {next.title}
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <div />
          )}
        </div>
      )}
    </article>
  );
}
