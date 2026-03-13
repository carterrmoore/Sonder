// src/app/krakow/guides/page.tsx
// Article index — lists all published Kraków guides.
//
// Layout: CityLayout sidebar={<StaticPageSidebar />}
// Token paths: flat.
// Server component — no "use client".

import type { Metadata } from "next";
import Link from "next/link";
import { adminClient } from "@/lib/supabase/admin";
import { tokens } from "@/lib/tokens";
import CityLayout from "@/components/layout/CityLayout";
import StaticPageSidebar from "@/components/layout/StaticPageSidebar";

export const metadata: Metadata = {
  title: "Kraków Guides | Sonder",
  description:
    "In-depth guides to eating, drinking, and navigating Kraków — written for visitors who want to understand the city, not just move through it.",
};

interface ArticleSummary {
  slug: string;
  title: string;
  subtitle: string | null;
  read_time_minutes: number;
  published_at: string;
  hero_color: string | null;
}

async function getArticles(): Promise<ArticleSummary[]> {
  const { data } = await adminClient
    .from("articles")
    .select(
      "slug, title, subtitle, read_time_minutes, published_at, hero_color"
    )
    .eq("city_id", "21b778e8-0b37-4adc-ae10-5a226929c59c")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  return (data ?? []) as ArticleSummary[];
}

export default async function GuidesIndexPage() {
  const articles = await getArticles();

  return (
    <CityLayout sidebar={<StaticPageSidebar />}>
      <div
        style={{
          padding: `${tokens.sp48} ${tokens.sp32} ${tokens.sp96}`,
        }}
      >
        <header style={{ marginBottom: tokens.sp48 }}>
          <p
            style={{
              fontFamily: tokens.fontBody,
              fontSize: tokens.textOverline,
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              color: tokens.ink,
              opacity: 0.45,
              marginBottom: tokens.sp8,
            }}
          >
            Kraków
          </p>
          <h1
            style={{
              fontFamily: tokens.fontDisplay,
              fontSize: tokens.textDisplayLg,
              fontWeight: 400,
              lineHeight: 1.15,
              color: tokens.ink,
              margin: `0 0 ${tokens.sp12} 0`,
            }}
          >
            Guides
          </h1>
          <p
            style={{
              fontFamily: tokens.fontBody,
              fontSize: tokens.textBodyLg,
              lineHeight: 1.6,
              color: tokens.ink,
              opacity: 0.55,
              margin: 0,
            }}
          >
            In-depth guides for visitors who want to understand the city, not
            just pass through it.
          </p>
        </header>

        <div
          style={{
            display: "flex",
            flexDirection: "column" as const,
            gap: "1px",
            backgroundColor: "rgba(26,26,24,0.08)",
            border: "1px solid rgba(26,26,24,0.08)",
            borderRadius: tokens.radiusCard,
            overflow: "hidden",
          }}
        >
          {articles.length === 0 ? (
            <div
              style={{
                padding: tokens.sp48,
                textAlign: "center" as const,
                fontFamily: tokens.fontBody,
                fontSize: tokens.textBodyMd,
                color: tokens.ink,
                opacity: 0.38,
                backgroundColor: tokens.warm,
              }}
            >
              Guides coming soon.
            </div>
          ) : (
            articles.map((article) => (
              <ArticleRow key={article.slug} article={article} />
            ))
          )}
        </div>
      </div>
    </CityLayout>
  );
}

function ArticleRow({ article }: { article: ArticleSummary }) {
  const accent = article.hero_color ?? tokens.gold;
  const date = new Date(article.published_at).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });

  return (
    <Link
      href={`/krakow/guides/${article.slug}`}
      style={{ textDecoration: "none" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: tokens.sp16,
          padding: "20px 24px",
          backgroundColor: tokens.card,
        }}
      >
        <div
          style={{
            width: "3px",
            height: "40px",
            backgroundColor: accent,
            borderRadius: "2px",
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              fontFamily: tokens.fontBody,
              fontSize: tokens.textBodyMd,
              fontWeight: 600,
              color: tokens.ink,
              margin: `0 0 ${tokens.sp4} 0`,
              lineHeight: 1.3,
            }}
          >
            {article.title}
          </h2>
          {article.subtitle && (
            <p
              style={{
                fontFamily: tokens.fontBody,
                fontSize: tokens.textBodySm,
                color: tokens.ink,
                opacity: 0.48,
                margin: 0,
                lineHeight: 1.4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap" as const,
              }}
            >
              {article.subtitle}
            </p>
          )}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column" as const,
            alignItems: "flex-end",
            gap: tokens.sp4,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: tokens.fontBody,
              fontSize: tokens.textCaption,
              color: tokens.ink,
              opacity: 0.32,
            }}
          >
            {article.read_time_minutes} min
          </span>
          <span
            style={{
              fontFamily: tokens.fontBody,
              fontSize: tokens.textCaption,
              color: tokens.ink,
              opacity: 0.22,
            }}
          >
            {date}
          </span>
        </div>
        <span
          style={{
            fontFamily: tokens.fontBody,
            fontSize: tokens.textBodyMd,
            color: tokens.ink,
            opacity: 0.18,
            flexShrink: 0,
          }}
        >
          &rarr;
        </span>
      </div>
    </Link>
  );
}
