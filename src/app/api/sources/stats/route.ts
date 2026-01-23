import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import Parser from "rss-parser";

// ✅ Helper: Fetch the clean Publication Name from the homepage
async function fetchSiteNameFromRoot(rssUrl: string): Promise<string | null> {
  try {
    // 1. Get the root domain (e.g. https://www.hindustantimes.com)
    const rootUrl = new URL(rssUrl).origin;

    // 2. Fetch the homepage HTML
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const res = await fetch(rootUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const html = await res.text();

    // 3. Strategy A: Look for og:site_name (Best for "Publication Name")
    // <meta property="og:site_name" content="Hindustan Times" />
    const ogMatch = html.match(
      /<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i,
    );
    if (ogMatch && ogMatch[1]) {
      return ogMatch[1].trim();
    }

    // 4. Strategy B: Look for application-name
    const appMatch = html.match(
      /<meta\s+name=["']application-name["']\s+content=["']([^"']+)["']/i,
    );
    if (appMatch && appMatch[1]) {
      return appMatch[1].trim();
    }

    // 5. Strategy C: Clean up the <title> tag
    // e.g. "TechCrunch | Startup and Technology News" -> "TechCrunch"
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      let title = titleMatch[1].trim();
      // Split by common separators |, :, - and take the first part
      title = title.split(/[|:-]/)[0].trim();
      return title;
    }
  } catch (e) {
    console.warn("Failed to fetch metadata from root domain", e);
  }
  return null;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sources = await prisma.source.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(sources);
  } catch (error) {
    return NextResponse.json(
      { error: "Error fetching sources" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url } = await request.json();
    if (!url)
      return NextResponse.json({ error: "URL is required" }, { status: 400 });

    let finalName = "";

    // 🚀 STEP 1: Try to get the Official Name from the Website's Meta tags
    const metaName = await fetchSiteNameFromRoot(url);
    if (metaName) {
      finalName = metaName;
    } else {
      // 🚀 STEP 2: Fallback to RSS Feed Title if meta tags fail
      try {
        const parser = new Parser({
          timeout: 5000,
          headers: { "User-Agent": "Khabri/1.0" },
        });
        const feed = await parser.parseURL(url);
        if (feed.title && feed.title.trim().length > 0) {
          finalName = feed.title.trim();
        }
      } catch (e) {
        console.warn("RSS Parse failed");
      }
    }

    // 🚀 STEP 3: Ultimate Fallback (Hostname cleanup)
    if (!finalName) {
      try {
        const hostname = new URL(url).hostname.replace("www.", "");
        const namePart = hostname.split(".")[0];
        finalName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      } catch (e) {
        finalName = "New Source";
      }
    }

    const newSource = await prisma.source.create({
      data: {
        name: finalName,
        url,
        type: "RSS",
        category: "General",
        userId: session.user.id,
      },
    });

    return NextResponse.json(newSource, { status: 201 });
  } catch (error) {
    console.error("POST Source Error:", error);
    return NextResponse.json(
      { error: "Failed to create source" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await request.json();
    const count = await prisma.source.count({
      where: { id, userId: session.user.id },
    });

    if (count === 0)
      return NextResponse.json({ error: "Source not found" }, { status: 404 });

    await prisma.source.delete({ where: { id } });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
