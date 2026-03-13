// src/app/krakow/guides/[slug]/page.tsx
// Article detail page — Step 8
//
// Layout: CityLayout sidebar={<StaticPageSidebar />}
// Token paths: flat — tokens.ink, tokens.sp48, tokens.radiusCard, etc.
// Server component — no "use client". generateMetadata handles SEO.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { adminClient } from "@/lib/supabase/admin";
import { tokens } from "@/lib/tokens";
import CityLayout from "@/components/layout/CityLayout";
import StaticPageSidebar from "@/components/layout/StaticPageSidebar";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ArticleEntry {
  id: string;
  name: string;
  category: string;
  slug: string;
  neighbourhood_name: string | null;
  editorial_hook: string | null;
  insider_tip: string | null;
  why_it_made_the_cut: string | null;
}

interface Article {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  body_html: string;
  published_at: string;
  updated_at: string;
  hero_color: string | null;
  read_time_minutes: number;
  has_affiliate_links: boolean;
  entry_ids: string[];
  referenced_entries: ArticleEntry[];
}

// ── Category accent colours ───────────────────────────────────────────────────

const CATEGORY_ACCENT: Record<string, string> = {
  restaurant:    tokens.gold,
  cafe:          tokens.gold,
  nightlife:     tokens.apricot,
  sight:         tokens.apricot,
  tour:          tokens.apricot,
  accommodation: "rgba(26,26,24,0.12)",
};

// ── Data fetch ────────────────────────────────────────────────────────────────

async function getArticle(slug: string): Promise<Article | null> {
  const { data: article, error } = await adminClient
    .from("articles")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (error || !article) return null;

  let referenced_entries: ArticleEntry[] = [];
  if (article.entry_ids?.length > 0) {
    const { data: entries } = await adminClient
      .from("entries")
      .select(`
        id, name, category, slug,
        editorial_hook, insider_tip, why_it_made_the_cut,
        neighbourhood:neighbourhood_id ( display_name )
      `)
      .in("id", article.entry_ids)
      .eq("review_status", "approved");

    if (entries) {
      referenced_entries = entries.map((e) => ({
        ...e,
        neighbourhood_name: Array.isArray(e.neighbourhood)
          ? (e.neighbourhood[0] as any)?.display_name ?? null
          : (e.neighbourhood as any)?.display_name ?? null,
      }));
    }
  }

  return { ...article, referenced_entries };
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "Not found" };

  return {
    title: `${article.title} | Sonder Kraków`,
    description: article.subtitle ?? undefined,
    openGraph: {
      title: article.title,
      description: article.subtitle ?? undefined,
      type: "article",
      publishedTime: article.published_at,
      modifiedTime: article.updated_at,
      authors: ["Sonder"],
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const heroColor = article.hero_color ?? tokens.ink;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.subtitle,
    datePublished: article.published_at,
    dateModified: article.updated_at,
    author: {
      "@type": "Organization",
      name: "Sonder",
      url: "https://sonderapp.co",
    },
    publisher: {
      "@type": "Organization",
      name: "Sonder",
      url: "https://sonderapp.co",
    },
    about: {
      "@type": "City",
      name: "Kraków",
      addressCountry: "PL",
    },
    url: `https://sonderapp.co/krakow/guides/${article.slug}`,
  };

  const publishedDate = new Date(article.published_at).toLocaleDateString(
    "en-GB",
    { day: "numeric", month: "long", year: "numeric" }
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <CityLayout sidebar={<StaticPageSidebar />}>
        {/* Hero sits at the top of the main column, outside the padded wrapper */}
        <div
          style={{
            width: "100%",
            height: "300px",
            backgroundColor: heroColor,
            position: "relative",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to top, rgba(26,26,24,0.65) 0%, transparent 55%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: tokens.sp24,
              left: tokens.sp32,
            }}
          >
            <Link
              href="/krakow/guides"
              style={{
                fontFamily: tokens.fontBody,
                fontSize: tokens.textBodySm,
                color: "rgba(245,240,232,0.65)",
                textDecoration: "none",
              }}
            >
              &larr; Guides
            </Link>
          </div>
          <div
            style={{
              position: "absolute",
              bottom: tokens.sp24,
              left: tokens.sp32,
            }}
          >
            <span
              style={{
                fontFamily: tokens.fontBody,
                fontSize: tokens.textOverline,
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase" as const,
                color: "rgba(245,240,232,0.55)",
              }}
            >
              Guide
            </span>
          </div>
        </div>

        {/* Article content */}
        <div
          style={{
            padding: `${tokens.sp48} ${tokens.sp32} ${tokens.sp96}`,
          }}
        >
          <div style={{ maxWidth: "680px" }}>

            <h1
              style={{
                fontFamily: tokens.fontDisplay,
                fontSize: tokens.textDisplayLg,
                fontWeight: 400,
                lineHeight: 1.15,
                color: tokens.ink,
                margin: `0 0 ${tokens.sp16} 0`,
              }}
            >
              {article.title}
            </h1>

            {/* Byline */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: tokens.sp16,
                marginBottom: tokens.sp32,
                paddingBottom: tokens.sp24,
                borderBottom: "1px solid rgba(26,26,24,0.1)",
                flexWrap: "wrap" as const,
              }}
            >
              {(
                [
                  { text: `Sonder · Kraków`, opacity: 0.5 },
                  { text: `${article.read_time_minutes} min read`, opacity: 0.32 },
                  { text: publishedDate, opacity: 0.28 },
                ] as const
              ).map(({ text, opacity }) => (
                <span
                  key={text}
                  style={{
                    fontFamily: tokens.fontBody,
                    fontSize: tokens.textBodySm,
                    color: tokens.ink,
                    opacity,
                  }}
                >
                  {text}
                </span>
              ))}
            </div>

            {/* Affiliate disclosure */}
            {article.has_affiliate_links && (
              <div
                style={{
                  backgroundColor: "rgba(26,26,24,0.04)",
                  border: "1px solid rgba(26,26,24,0.08)",
                  borderRadius: tokens.radiusCard,
                  padding: `${tokens.sp12} ${tokens.sp16}`,
                  marginBottom: tokens.sp32,
                }}
              >
                <p
                  style={{
                    fontFamily: tokens.fontBody,
                    fontSize: tokens.textCaption,
                    color: tokens.ink,
                    opacity: 0.55,
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  We may earn a small commission if you book through our links.
                  It does not affect our recommendations — we only link to
                  places that earned their place here.
                </p>
              </div>
            )}

            {/* Body */}
            <div
              className="article-prose"
              dangerouslySetInnerHTML={{ __html: article.body_html }}
            />

            {/* Referenced entries */}
            {article.referenced_entries.length > 0 && (
              <div style={{ marginTop: tokens.sp64 }}>
                <p
                  style={{
                    fontFamily: tokens.fontBody,
                    fontSize: tokens.textOverline,
                    fontWeight: 500,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase" as const,
                    color: tokens.ink,
                    opacity: 0.35,
                    margin: `0 0 ${tokens.sp24} 0`,
                  }}
                >
                  Mentioned in this guide
                </p>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column" as const,
                    gap: tokens.sp8,
                  }}
                >
                  {article.referenced_entries.map((entry) => (
                    <InlineEntryCard key={entry.id} entry={entry} />
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </CityLayout>
    </>
  );
}

// ── Inline entry card ─────────────────────────────────────────────────────────

function InlineEntryCard({ entry }: { entry: ArticleEntry }) {
  const hook =
    entry.editorial_hook ??
    entry.insider_tip ??
    entry.why_it_made_the_cut ??
    null;
  const accent = CATEGORY_ACCENT[entry.category] ?? "rgba(26,26,24,0.1)";

  return (
    <Link href={`/krakow/${entry.slug}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: tokens.sp16,
          padding: tokens.sp16,
          backgroundColor: tokens.card,
          borderRadius: tokens.radiusCard,
          boxShadow: tokens.shadowCardRest,
          border: "1px solid rgba(26,26,24,0.06)",
        }}
      >
        <div
          style={{
            width: "3px",
            alignSelf: "stretch",
            backgroundColor: accent,
            borderRadius: "2px",
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontFamily: tokens.fontBody,
              fontSize: tokens.textCaption,
              color: tokens.ink,
              opacity: 0.38,
              textTransform: "capitalize" as const,
              display: "block",
              marginBottom: tokens.sp4,
            }}
          >
            {entry.category}
            {entry.neighbourhood_name && ` · ${entry.neighbourhood_name}`}
          </span>
          <h3
            style={{
              fontFamily: tokens.fontBody,
              fontSize: tokens.textBodyMd,
              fontWeight: 600,
              color: tokens.ink,
              margin: `0 0 ${tokens.sp4} 0`,
            }}
          >
            {entry.name}
          </h3>
          {hook && (
            <p
              style={{
                fontFamily: tokens.fontBody,
                fontSize: tokens.textBodySm,
                color: tokens.ink,
                opacity: 0.6,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {hook}
            </p>
          )}
        </div>
        <span
          style={{
            fontFamily: tokens.fontBody,
            fontSize: tokens.textBodyMd,
            color: tokens.ink,
            opacity: 0.2,
            flexShrink: 0,
            alignSelf: "center",
          }}
        >
          &rarr;
        </span>
      </div>
    </Link>
  );
}
