"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CATEGORY_DISPLAY, COLOR_GROUPS } from "@/pipeline/constants";
import type { EntryCardData } from "@/lib/entries";
import { buildPhotoUrl, fetchPlacePhotos } from "@/lib/maps";
import CategoryPill from "@/components/ui/CategoryPill";

interface EntryCardProps {
  entry: EntryCardData;
  score?: number;
  featured?: boolean;
  rank?: number;
}

type PhotoState =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error" };

export default function EntryCard({ entry, featured = false, rank }: EntryCardProps) {
  const display = CATEGORY_DISPLAY[entry.category];
  const pillBg = COLOR_GROUPS[display?.colorGroup]?.bg ?? "var(--color-surface-3)";

  // ── Editorial hook: fallback chain ─────────────────────────────────────────
  const hook =
    entry.editorial_hook ||
    (entry as any).insider_tip ||
    (entry as any).why_it_made_the_cut ||
    null;

  // ── Neighbourhood ──────────────────────────────────────────────────────────
  const neighbourhoodName =
    typeof entry.neighbourhood === "string"
      ? entry.neighbourhood
      : Array.isArray(entry.neighbourhood)
      ? (entry.neighbourhood[0] as any)?.display_name ?? null
      : (entry.neighbourhood as any)?.display_name ?? null;

  // ── Photo resolution ───────────────────────────────────────────────────────
  const pipelineUrl: string | null =
    (entry.raw_pipeline_data as any)?.photos?.selected_url ?? null;

  const [photo, setPhoto] = useState<PhotoState>(
    pipelineUrl ? { status: "ready", url: pipelineUrl } : { status: "loading" }
  );

  useEffect(() => {
    if (pipelineUrl) return;
    if (!entry.google_place_id) {
      setPhoto({ status: "error" });
      return;
    }
    let cancelled = false;
    fetchPlacePhotos(entry.google_place_id, 1)
      .then((names) => {
        if (cancelled) return;
        if (names.length === 0) { setPhoto({ status: "error" }); return; }
        setPhoto({ status: "ready", url: buildPhotoUrl(names[0], 800) });
      })
      .catch(() => { if (!cancelled) setPhoto({ status: "error" }); });
    return () => { cancelled = true; };
  }, [entry.google_place_id, pipelineUrl]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Link
      href={`/krakow/${entry.slug}`}
      style={{
        textDecoration: "none",
        display: "block",
        gridColumn: featured ? "span 2" : undefined,
        height: "100%",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--color-card)",
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-card-rest)",
          overflow: "hidden",
          transition: "box-shadow 200ms ease",
          cursor: "pointer",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-card-hover)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-card-rest)";
        }}
      >
        {/* Photo area — 3:2 standard, 16:9 featured */}
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: featured ? "16 / 9" : "3 / 2",
            flexShrink: 0,
            overflow: "hidden",
            backgroundColor: photo.status === "error" ? pillBg : "var(--color-surface-2)",
          }}
        >
          {photo.status === "loading" && <ShimmerSkeleton />}

          {photo.status === "ready" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.url}
              alt={entry.name}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                borderRadius: 0,
              }}
              onError={() => setPhoto({ status: "error" })}
            />
          )}

          {/* Category pill — always visible regardless of photo state */}
          <div style={{ position: "absolute", top: 12, left: 12, zIndex: 1 }}>
            <CategoryPill category={entry.category} size="sm" />
          </div>

          {/* Rank badge — top-right, ranks 1–5 only */}
          {rank !== undefined && (
            <div
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                zIndex: 1,
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                backgroundColor: rank === 1
                  ? "var(--color-gold)"
                  : "rgba(245, 240, 232, 0.85)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-body)",
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--color-ink)",
                backdropFilter: "blur(4px)",
              }}
            >
              {rank}
            </div>
          )}
        </div>

        {/* Card body — always renders, independent of photo state */}
        <div style={{ padding: "20px", flex: 1, display: "flex", flexDirection: "column" }}>
          {neighbourhoodName && (
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-caption)",
                color: "var(--color-ink)",
                opacity: 0.5,
                margin: "0 0 4px",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {neighbourhoodName}
            </p>
          )}

          <h3
            className="text-heading-lg"
            style={{
              margin: "0 0 8px",
              color: "var(--color-ink)",
            }}
          >
            {entry.name}
          </h3>

          {hook && (
            <p
              className="line-clamp-2"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body-sm)",
                lineHeight: "var(--leading-body-sm)",
                color: "var(--color-ink)",
                opacity: 0.72,
                margin: 0,
              }}
            >
              {hook}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Shimmer skeleton ──────────────────────────────────────────────────────────

function ShimmerSkeleton() {
  return (
    <>
      <style>{`
        @keyframes sonder-shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
      `}</style>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, #f0ebe3 25%, #e8e2d8 50%, #f0ebe3 75%)",
          backgroundSize: "800px 100%",
          animation: "sonder-shimmer 1.4s ease-in-out infinite",
        }}
      />
    </>
  );
}
