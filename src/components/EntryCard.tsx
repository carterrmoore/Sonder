"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CATEGORY_DISPLAY, COLOR_GROUPS } from "@/pipeline/constants";
import type { EntryCardData } from "@/lib/entries";
import { buildPhotoUrl, fetchPlacePhotos } from "@/lib/maps";
import CategoryPill from "@/components/ui/CategoryPill";
import { tokens } from "@/lib/tokens";

interface EntryCardProps {
  entry: EntryCardData;
  /** Preference score 0–100; controls a subtle visual rank signal */
  score?: number;
}

type PhotoState =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error" };

export default function EntryCard({ entry, score }: EntryCardProps) {
  const display = CATEGORY_DISPLAY[entry.category];

  // ── Photo resolution ──────────────────────────────────────────────────────

  // Priority 1: pipeline-curated photo
  const pipelineUrl: string | null =
    (entry.raw_pipeline_data as any)?.photos?.selected_url ?? null;

  const [photo, setPhoto] = useState<PhotoState>(
    pipelineUrl ? { status: "ready", url: pipelineUrl } : { status: "loading" }
  );

  useEffect(() => {
    // If we already have a pipeline URL, nothing to do
    if (pipelineUrl) return;

    // Priority 2: Google Maps via fetchPlacePhotos + buildPhotoUrl
    if (!entry.google_place_id) {
      setPhoto({ status: "error" });
      return;
    }

    let cancelled = false;
    fetchPlacePhotos(entry.google_place_id, 1)
      .then((names) => {
        if (cancelled) return;
        if (names.length === 0) {
          setPhoto({ status: "error" });
          return;
        }
        setPhoto({ status: "ready", url: buildPhotoUrl(names[0], 800) });
      })
      .catch(() => {
        if (!cancelled) setPhoto({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [entry.google_place_id, pipelineUrl]);

  // ── Render ────────────────────────────────────────────────────────────────

  const neighbourhoodName = entry.neighbourhood;

  return (
    <Link
      href={`/krakow/${entry.slug}`}
      style={{ textDecoration: "none", display: "block" }}
    >
      <div
        style={{
          backgroundColor: tokens.card,
          borderRadius: tokens.radiusCard,
          boxShadow: tokens.shadowCardRest,
          overflow: "hidden",
          transition: "box-shadow 0.2s ease",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = tokens.shadowCardHover;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = tokens.shadowCardRest;
        }}
      >
        {/* ── Photo area (16:9 via aspect-video) ── */}
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16 / 9",
            overflow: "hidden",
            backgroundColor: tokens.card,
          }}
        >
          {photo.status === "loading" && <ShimmerSkeleton />}

          {photo.status === "ready" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.url}
              alt={entry.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
              onError={() => setPhoto({ status: "error" })}
            />
          )}

          {photo.status === "error" && (
            <div
              style={{
                width: "100%",
                height: "100%",
                backgroundColor: tokens.ink,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CategoryPill category={entry.category} />
            </div>
          )}

          {/* Category pill — overlaid top-left on every photo state */}
          {photo.status !== "error" && (
            <div style={{ position: "absolute", top: 12, left: 12 }}>
              <CategoryPill category={entry.category} />
            </div>
          )}
        </div>

        {/* ── Card body ── */}
        <div style={{ padding: tokens.sp16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: tokens.sp4,
            }}
          >
            <span
              style={{
                fontFamily: tokens.fontBody,
                fontSize: tokens.textCaption,
                color: tokens.ink,
                opacity: 0.5,
              }}
            >
              {neighbourhoodName ?? ""}
            </span>
          </div>

          <h3
            style={{
              fontFamily: tokens.fontDisplay,
              fontSize: tokens.textHeadingSm,
              fontWeight: 400,
              color: tokens.ink,
              margin: `0 0 ${tokens.sp8}`,
              lineHeight: 1.2,
            }}
          >
            {entry.name}
          </h3>

          {entry.editorial_hook && (
            <p
              style={{
                fontFamily: tokens.fontBody,
                fontSize: tokens.textBodySm,
                color: tokens.ink,
                opacity: 0.75,
                margin: 0,
                lineHeight: 1.5,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {entry.editorial_hook}
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
          100% { background-position: 400px 0; }
        }
      `}</style>
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(90deg, #ffffff 25%, #f0ede8 50%, #ffffff 75%)",
          backgroundSize: "800px 100%",
          animation: "sonder-shimmer 1.4s ease-in-out infinite",
        }}
      />
    </>
  );
}
