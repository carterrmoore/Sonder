"use client";

import Link from "next/link";
import { Bookmark } from "lucide-react";
import CategoryPill from "@/components/ui/CategoryPill";
import {
  CATEGORY_DISPLAY,
  COLOR_GROUPS,
  PRICE_LEVEL_LABELS,
  type PriceLevel,
} from "@/pipeline/constants";
import type { EntryCardData } from "@/lib/entries";

export interface EntryCardProps {
  entry: EntryCardData;
  citySlug?: string;
  onSave?: (id: string) => void;
  isSaved?: boolean;
  className?: string;
}

export default function EntryCard({
  entry,
  citySlug = "krakow",
  onSave,
  isSaved = false,
  className,
}: EntryCardProps) {
  const config = CATEGORY_DISPLAY[entry.category];
  const colors = COLOR_GROUPS[config.colorGroup];
  const photoUrl = entry.photos?.[0] ?? null;

  return (
    <Link
      href={`/${citySlug}/${entry.slug ?? entry.id}`}
      className={className}
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        backgroundColor: "var(--color-card)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-card-rest)",
        overflow: "hidden",
        transition: "box-shadow 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-card-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-card-rest)";
      }}
    >
      {/* ── Image area — 55% of card height ─────────────────────────────── */}
      <div
        style={{
          position: "relative",
          aspectRatio: "16 / 10",
          backgroundColor: photoUrl ? undefined : "var(--color-surface-3)",
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

        {/* Save / bookmark icon */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSave?.(entry.id);
          }}
          aria-label={isSaved ? "Remove bookmark" : "Save bookmark"}
          style={{
            position: "absolute",
            top: "var(--spacing-px-12)",
            right: "var(--spacing-px-12)",
            backgroundColor: "rgba(26, 26, 24, 0.80)",
            border: "none",
            borderRadius: "var(--radius-button)",
            padding: "6px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-warm)",
            lineHeight: 0,
          }}
        >
          <Bookmark
            size={16}
            fill={isSaved ? "currentColor" : "none"}
            strokeWidth={1.5}
          />
        </button>
      </div>

      {/* ── Text area ───────────────────────────────────────────────────── */}
      <div style={{ padding: "var(--spacing-px-16)" }}>
        {/* Venue name — HeadingLG */}
        <h3
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-heading-lg)",
            fontWeight: 600,
            lineHeight: "var(--leading-heading-lg)",
            color: "var(--color-ink)",
            margin: "0 0 var(--spacing-px-4) 0",
          }}
        >
          {entry.name}
        </h3>

        {/* Neighbourhood + category pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-px-8)",
            marginBottom: "var(--spacing-px-8)",
          }}
        >
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
          <CategoryPill category={entry.category} size="sm" />
        </div>

        {/* Editorial hook — 2-line clamp */}
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-md)",
            fontWeight: 400,
            lineHeight: "var(--leading-body-md)",
            color: "var(--color-ink)",
            margin: 0,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
          }}
        >
          {entry.editorial_hook}
        </p>

        {/* Price level — Caption, only if > 0 */}
        {entry.price_level != null && entry.price_level > 0 && (
          <span
            style={{
              display: "inline-block",
              marginTop: "var(--spacing-px-8)",
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-caption)",
              color: "var(--color-ink)",
              opacity: 0.5,
            }}
          >
            {PRICE_LEVEL_LABELS[entry.price_level as PriceLevel]}
          </span>
        )}
      </div>
    </Link>
  );
}
