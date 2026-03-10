"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import CategoryPill from "@/components/ui/CategoryPill";
import { useItinerary } from "@/hooks/useItinerary";
import { buildPhotoUrl, fetchPlacePhotos } from "@/lib/maps";
import {
  CATEGORY_DISPLAY,
  COLOR_GROUPS,
  PRICE_LEVEL_LABELS,
  type PriceLevel,
} from "@/pipeline/constants";
import type { EntryFull } from "@/lib/entries";
import type { EntryCardData } from "@/lib/entries";
import type { TimeBlock } from "@/types/itinerary";
import { tokens } from "@/lib/tokens";

// ─────────────────────────────────────────────────────────────────────────────
// Hero photo state
// ─────────────────────────────────────────────────────────────────────────────

type HeroPhotoState =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error" };

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface EntryDetailProps {
  entry: EntryFull;
}

export default function EntryDetail({ entry }: EntryDetailProps) {
  // ── Hero photo ────────────────────────────────────────────────────────────
  // Priority 1: pipeline-selected photo resource name stored in photos[]
  const storedUrl: string | null = entry.photos?.[0]
    ? buildPhotoUrl(entry.photos[0], 1600)
    : null;

  const [heroPhoto, setHeroPhoto] = useState<HeroPhotoState>(
    storedUrl ? { status: "ready", url: storedUrl } : { status: "loading" }
  );

  useEffect(() => {
    if (storedUrl) return;
    if (!entry.google_place_id) {
      setHeroPhoto({ status: "error" });
      return;
    }
    let cancelled = false;
    fetchPlacePhotos(entry.google_place_id, 1)
      .then((names) => {
        if (cancelled) return;
        if (!names.length) { setHeroPhoto({ status: "error" }); return; }
        setHeroPhoto({ status: "ready", url: buildPhotoUrl(names[0], 1600) });
      })
      .catch(() => { if (!cancelled) setHeroPhoto({ status: "error" }); });
    return () => { cancelled = true; };
  }, [entry.google_place_id, storedUrl]);

  // ── Hero fallback color ───────────────────────────────────────────────────
  const heroFallbackColor =
    COLOR_GROUPS[CATEGORY_DISPLAY[entry.category]?.colorGroup]?.bg ?? "#E8E3DA";

  // ── Itinerary hook ────────────────────────────────────────────────────────
  const { itinerary, addEntry } = useItinerary("krakow");

  // ── Derived ───────────────────────────────────────────────────────────────
  const priceLabel =
    entry.price_level != null && entry.price_level > 0
      ? PRICE_LEVEL_LABELS[entry.price_level as PriceLevel]
      : null;

  const tags: string[] = Array.isArray(entry.tags) ? entry.tags : [];

  const isInItinerary = itinerary?.days.some((d) =>
    d.slots.some((s) => s.entryId === entry.id)
  ) ?? false;

  return (
    <div style={{ backgroundColor: tokens.warm, minHeight: "100vh" }}>

      {/* ── Hero photo — full width, no border radius ── */}
      <div
        style={{
          width: "100%",
          aspectRatio: "16 / 9",
          backgroundColor: heroFallbackColor,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {heroPhoto.status === "ready" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroPhoto.url}
            alt={entry.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
            onError={() => setHeroPhoto({ status: "error" })}
          />
        )}
        {/* loading → dark surface; error → dark surface — no decoration */}
      </div>

      {/* ── Content ── */}
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: `${tokens.sp48} ${tokens.sp24} ${tokens.sp96}`,
        }}
      >
        {/* ── Back navigation — after hero, before venue name ── */}
        <a
          href="/krakow"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: tokens.fontBody,
            fontSize: tokens.textCaption,
            color: tokens.ink,
            opacity: 0.5,
            textDecoration: "none",
            marginBottom: tokens.sp32,
          }}
        >
          ← Back to Kraków
        </a>

        {/* ── Venue name ── */}
        <h1
          style={{
            fontFamily: tokens.fontDisplay,
            fontSize: tokens.textDisplaySm,
            fontWeight: 400,
            color: tokens.ink,
            margin: `0 0 ${tokens.sp16}`,
            lineHeight: 1.15,
          }}
        >
          {entry.name}
        </h1>

        {/* ── Editorial hook ── */}
        {entry.editorial_hook && (
          <p
            style={{
              fontFamily: tokens.fontBody,
              fontSize: tokens.textBodyLg,
              color: tokens.ink,
              opacity: 0.8,
              margin: `0 0 ${tokens.sp24}`,
              lineHeight: 1.6,
            }}
          >
            {entry.editorial_hook}
          </p>
        )}

        {/* ── Metadata row ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: tokens.sp24,
          }}
        >
          {entry.neighbourhood && (
            <span
              style={{
                fontFamily: tokens.fontBody,
                fontSize: tokens.textCaption,
                color: tokens.ink,
                opacity: 0.6,
                backgroundColor: `color-mix(in srgb, ${tokens.ink} 8%, transparent)`,
                padding: "3px 10px",
                borderRadius: tokens.radiusPill,
              }}
            >
              {entry.neighbourhood}
            </span>
          )}

          <CategoryPill category={entry.category} />

          {priceLabel && (
            <span
              style={{
                fontFamily: tokens.fontBody,
                fontSize: tokens.textCaption,
                color: tokens.ink,
                opacity: 0.6,
              }}
            >
              {priceLabel}
            </span>
          )}

          {entry.maps_url && (
            <a
              href={entry.maps_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: tokens.fontBody,
                fontSize: tokens.textCaption,
                color: tokens.ink,
                opacity: 0.6,
                textDecoration: "underline",
                textUnderlineOffset: "2px",
              }}
            >
              Get directions
            </a>
          )}
        </div>

        {/* ── Tags row ── */}
        {tags.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: tokens.sp32,
            }}
          >
            {tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontFamily: tokens.fontBody,
                  fontSize: tokens.textCaption,
                  color: tokens.ink,
                  backgroundColor: tokens.card,
                  borderRadius: tokens.radiusPill,
                  padding: "8px 12px",
                  opacity: 0.85,
                }}
              >
                {tag.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}

        {/* ── Add to itinerary ── */}
        <AddToItineraryButton
          entry={entry}
          itinerary={itinerary}
          addEntry={addEntry}
          isInItinerary={isInItinerary}
        />

        {/* ── Editorial writeup ── */}
        {entry.editorial_writeup && (
          <div
            style={{
              fontFamily: tokens.fontBody,
              fontSize: tokens.textBodyMd,
              color: tokens.ink,
              lineHeight: 1.75,
              marginTop: tokens.sp48,
              opacity: 0.9,
              whiteSpace: "pre-line",
            }}
          >
            {entry.editorial_writeup}
          </div>
        )}

        {/* ── Editorial rationale ── */}
        {entry.editorial_rationale && (
          <p
            style={{
              fontFamily: tokens.fontBody,
              fontSize: tokens.textBodyMd,
              lineHeight: "var(--leading-body-md)",
              color: tokens.ink,
              opacity: 0.75,
              marginTop: tokens.sp32,
            }}
          >
            {entry.editorial_rationale}
          </p>
        )}

        {/* ── Insider tip ── */}
        {entry.insider_tip && (
          <div
            style={{
              marginTop: tokens.sp40,
              padding: tokens.sp24,
              backgroundColor: tokens.card,
              borderRadius: tokens.radiusCard,
              borderLeft: `3px solid ${tokens.gold}`,
            }}
          >
            <p
              style={{
                fontFamily: tokens.fontBody,
                fontSize: tokens.textCaption,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: tokens.gold,
                margin: "0 0 8px",
              }}
            >
              Insider tip
            </p>
            <p
              style={{
                fontFamily: tokens.fontBody,
                fontSize: tokens.textBodyMd,
                color: tokens.ink,
                margin: 0,
                lineHeight: 1.6,
                opacity: 0.85,
              }}
            >
              {entry.insider_tip}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AddToItineraryButton
// ─────────────────────────────────────────────────────────────────────────────

function AddToItineraryButton({
  entry,
  itinerary,
  addEntry,
  isInItinerary,
}: {
  entry: EntryFull;
  itinerary: ReturnType<typeof useItinerary>["itinerary"];
  addEntry: ReturnType<typeof useItinerary>["addEntry"];
  isInItinerary: boolean;
}) {
  const router = useRouter();

  function handleClick() {
    if (!itinerary) {
      router.push("/krakow/itinerary");
      return;
    }
    if (isInItinerary) return;

    // Build minimal EntryCardData from EntryFull for the hook
    const entryCardData: EntryCardData = {
      id: entry.id,
      slug: entry.slug,
      name: entry.name,
      category: entry.category,
      neighbourhood: entry.neighbourhood,
      editorial_hook: entry.editorial_hook,
      raw_pipeline_data: null,
      price_level: entry.price_level,
      tags: entry.tags,
      google_place_id: entry.google_place_id,
    };

    // Find the first day with the fewest slots — add as morning
    const targetDay = itinerary.days.reduce((best, d) =>
      d.slots.length < best.slots.length ? d : best
    , itinerary.days[0]);

    // Pick a time block not yet taken on that day (morning → afternoon → evening)
    const takenBlocks = new Set(targetDay.slots.map((s) => s.timeBlock));
    const block: TimeBlock =
      !takenBlocks.has("morning") ? "morning" :
      !takenBlocks.has("afternoon") ? "afternoon" :
      "evening";

    addEntry(entryCardData, targetDay.dayNumber, block);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        fontFamily: tokens.fontBody,
        fontWeight: 500,
        fontSize: tokens.textBodyMd,
        color: isInItinerary ? tokens.gold : tokens.ink,
        backgroundColor: isInItinerary
          ? `color-mix(in srgb, ${tokens.gold} 10%, transparent)`
          : "transparent",
        border: isInItinerary
          ? `1px solid ${tokens.gold}`
          : "1px solid rgba(26, 26, 24, 0.35)",
        borderRadius: tokens.radiusButton,
        padding: `${tokens.sp12} ${tokens.sp24}`,
        cursor: isInItinerary ? "default" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        marginBottom: tokens.sp8,
        transition: "border-color 0.15s ease, background-color 0.15s ease",
      }}
    >
      {isInItinerary ? "✓ In your itinerary" : !itinerary ? "Plan your trip →" : "+ Add to itinerary"}
    </button>
  );
}
