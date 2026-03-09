import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import CategoryPill from "@/components/ui/CategoryPill";
import Container from "@/components/ui/Container";
import { getEntryBySlug, getApprovedSlugs } from "@/lib/entries";
import {
  PRICE_LEVEL_LABELS,
  type PriceLevel,
} from "@/pipeline/constants";

const KRAKOW_CITY_ID = "21b778e8-0b37-4adc-ae10-5a226929c59c";

// ─────────────────────────────────────────────────────────────────────────────
// Static params
// ─────────────────────────────────────────────────────────────────────────────

export async function generateStaticParams() {
  const slugs = await getApprovedSlugs(KRAKOW_CITY_ID);
  return slugs.map((slug) => ({ slug }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function EntryDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const entry = await getEntryBySlug(slug);
  if (!entry) notFound();

  const photoUrl = entry.photos?.[0] ?? null;

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--color-warm)",
      }}
    >
      {/* ── Hero image ─────────────────────────────────────────────────── */}
      <div
        style={{
          width: "100%",
          aspectRatio: "16 / 9",
          backgroundColor: photoUrl ? undefined : "var(--color-surface-2)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={entry.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CategoryPill category={entry.category} size="md" />
          </div>
        )}
      </div>

      {/* ── Entry header ───────────────────────────────────────────────── */}
      <Container narrow style={{ paddingTop: "var(--spacing-px-40)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-px-8)",
            marginBottom: "var(--spacing-px-12)",
          }}
        >
          <CategoryPill category={entry.category} size="sm" />
          {entry.neighbourhood && (
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-caption)",
                color: "var(--color-ink)",
                opacity: 0.5,
              }}
            >
              {entry.neighbourhood}
            </span>
          )}
        </div>

        <h1
          className="text-display-md"
          style={{
            color: "var(--color-ink)",
            margin: "0 0 var(--spacing-px-12) 0",
          }}
        >
          {entry.name}
        </h1>

        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-lg)",
            lineHeight: "var(--leading-body-lg)",
            color: "var(--color-ink)",
            margin: 0,
          }}
        >
          {entry.editorial_hook}
        </p>
      </Container>

      {/* ── Divider ────────────────────────────────────────────────────── */}
      <Container narrow>
        <hr
          style={{
            border: "none",
            borderTop: "1px solid rgba(26, 26, 24, 0.10)",
            margin: "var(--spacing-px-32) 0",
          }}
        />
      </Container>

      {/* ── Editorial rationale ────────────────────────────────────────── */}
      {entry.editorial_rationale && (
        <Container narrow>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-body-md)",
              lineHeight: "var(--leading-body-md)",
              color: "var(--color-ink)",
              margin: "0 0 var(--spacing-px-32) 0",
            }}
          >
            {entry.editorial_rationale}
          </p>
        </Container>
      )}

      {/* ── Practical info strip ───────────────────────────────────────── */}
      <Container narrow>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-px-16)",
            flexWrap: "wrap",
            backgroundColor: "var(--color-warm)",
            border: "1px solid rgba(26, 26, 24, 0.10)",
            borderRadius: "var(--radius-card)",
            padding: "var(--spacing-px-12) var(--spacing-px-16)",
            marginBottom: "var(--spacing-px-32)",
          }}
        >
          {entry.price_level != null && entry.price_level > 0 && (
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body-sm)",
                color: "var(--color-ink)",
                opacity: 0.65,
              }}
            >
              {PRICE_LEVEL_LABELS[entry.price_level as PriceLevel]}
            </span>
          )}
          {entry.neighbourhood && (
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body-sm)",
                color: "var(--color-ink)",
                opacity: 0.65,
              }}
            >
              {entry.neighbourhood}
            </span>
          )}
          {entry.maps_url && (
            <a
              href={entry.maps_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-caption)",
                color: "var(--color-ink)",
                opacity: 0.65,
                textDecoration: "underline",
                textUnderlineOffset: "2px",
              }}
            >
              Get directions
            </a>
          )}
        </div>
      </Container>

      {/* ── Editorial writeup ──────────────────────────────────────────── */}
      {entry.editorial_writeup && (
        <Container narrow>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-body-md)",
              lineHeight: "var(--leading-body-md)",
              color: "var(--color-ink)",
              margin: "0 0 var(--spacing-px-32) 0",
              whiteSpace: "pre-line",
            }}
          >
            {entry.editorial_writeup}
          </p>
        </Container>
      )}

      {/* ── Tags ───────────────────────────────────────────────────────── */}
      {entry.tags && entry.tags.length > 0 && (
        <Container narrow>
          <div
            style={{
              display: "flex",
              gap: "var(--spacing-px-8)",
              flexWrap: "wrap",
              marginBottom: "var(--spacing-px-32)",
            }}
          >
            {entry.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-caption)",
                  lineHeight: "var(--leading-caption)",
                  color: "var(--color-ink)",
                  border: "1px solid rgba(26, 26, 24, 0.30)",
                  borderRadius: "var(--radius-button)",
                  padding: "2px 10px",
                  whiteSpace: "nowrap",
                }}
              >
                {tag.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </Container>
      )}

      {/* ── Back navigation ────────────────────────────────────────────── */}
      <Container narrow style={{ paddingBottom: "var(--spacing-px-64)" }}>
        <Link
          href="/krakow"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--spacing-px-8)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-sm)",
            color: "var(--color-ink)",
            opacity: 0.65,
            textDecoration: "none",
            padding: "var(--spacing-px-8) var(--spacing-px-12)",
            borderRadius: "var(--radius-button)",
            border: "1px solid rgba(26, 26, 24, 0.15)",
            transition: "opacity 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "0.65";
          }}
        >
          <ArrowLeft size={14} />
          Back to Kraków
        </Link>
      </Container>
    </main>
  );
}
