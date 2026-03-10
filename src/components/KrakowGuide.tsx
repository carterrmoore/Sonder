"use client";

import { useState, useEffect, useMemo } from "react";
import Container from "@/components/ui/Container";
import Grid from "@/components/ui/Grid";
import SectionSpacer from "@/components/ui/SectionSpacer";
import EntryCard from "@/components/EntryCard";
import { CATEGORY_DISPLAY } from "@/pipeline/constants";
import type { EntryCardData } from "@/lib/entries";
import type { Category } from "@/types/pipeline";
import type { TripPreferences } from "@/types/preferences";
import { applyPreferences } from "@/lib/preference-filter";
import { tokens } from "@/lib/tokens";

const CATEGORY_PLURAL: Record<Category, string> = {
  restaurant:    "Restaurants",
  cafe:          "Cafés",
  accommodation: "Accommodation",
  tour:          "Experiences",
  sight:         "Sights",
  nightlife:     "Nightlife",
};

interface KrakowGuideProps {
  entries: EntryCardData[];
}

export default function KrakowGuide({ entries }: KrakowGuideProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category | "all">("all");
  const [preferences, setPreferences] = useState<TripPreferences | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [hasItinerary, setHasItinerary] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("sonder_preferences_krakow");
      if (stored) setPreferences(JSON.parse(stored) as TripPreferences);
    } catch {}
    try {
      const raw = localStorage.getItem("sonder_itinerary_krakow");
      if (raw) {
        const parsed = JSON.parse(raw);
        const hasSlots = parsed?.days?.some(
          (d: { slots: unknown[] }) => d.slots.length > 0
        );
        setHasItinerary(!!hasSlots);
      }
    } catch {}
  }, []);

  const scoredEntries = useMemo(
    () => applyPreferences(entries, preferences),
    [entries, preferences]
  );

  const categories = [
    "all" as const,
    ...Array.from(new Set(entries.map((e) => e.category))),
  ];

  const filtered =
    selectedCategory === "all"
      ? scoredEntries
      : scoredEntries.filter((se) => se.entry.category === selectedCategory);

  const sectionTitle =
    selectedCategory === "all"
      ? "All recommendations"
      : CATEGORY_PLURAL[selectedCategory];

  const countLabel =
    selectedCategory === "all"
      ? `${filtered.length} places`
      : `${filtered.length} ${CATEGORY_PLURAL[selectedCategory].toLowerCase()}`;

  return (
    <main style={{ minHeight: "100vh", backgroundColor: tokens.warm }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: tokens.ink,
          minHeight: "70vh",
          display: "flex",
          alignItems: "center",
          paddingBlock: tokens.sp80,
        }}
      >
        <Container narrow>
          {/* Overline */}
          <p
            style={{
              fontFamily: tokens.fontBody,
              fontSize: tokens.textOverline,
              fontWeight: 500,
              lineHeight: "var(--leading-overline)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: tokens.gold,
              margin: `0 0 ${tokens.sp16} 0`,
            }}
          >
            Kraków, Poland
          </p>

          {/* Display headline */}
          <h1
            className="text-display-xl"
            style={{
              color: tokens.warm,
              margin: `0 0 ${tokens.sp24} 0`,
            }}
          >
            A city that rewards the unhurried.
          </h1>

          {/* Subheading */}
          <p
            style={{
              fontFamily: tokens.fontBody,
              fontSize: tokens.textBodyLg,
              lineHeight: "var(--leading-body-lg)",
              color: tokens.warm,
              opacity: 0.7,
              maxWidth: "480px",
              margin: 0,
            }}
          >
            {entries.length} places worth your time. No tourist traps. No paid
            placements. Chosen by people who live here.
          </p>

          {/* CTA row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: tokens.sp12,
              flexWrap: "wrap",
              marginTop: tokens.sp24,
            }}
          >
            <a
              href="/krakow/plan"
              style={{
                display: "inline-block",
                fontFamily: tokens.fontBody,
                fontWeight: 600,
                fontSize: tokens.textBodyMd,
                backgroundColor: tokens.gold,
                color: tokens.ink,
                border: "none",
                borderRadius: tokens.radiusButton,
                padding: `${tokens.sp16} ${tokens.sp32}`,
                cursor: "pointer",
                textDecoration: "none",
                transition: "opacity 0.15s ease",
              }}
            >
              Plan my trip →
            </a>
            {hasItinerary && (
              <a
                href="/krakow/itinerary"
                style={{
                  display: "inline-block",
                  fontFamily: tokens.fontBody,
                  fontWeight: 600,
                  fontSize: tokens.textBodyMd,
                  backgroundColor: "transparent",
                  color: tokens.warm,
                  border: "1px solid rgba(245, 240, 232, 0.35)",
                  borderRadius: tokens.radiusButton,
                  padding: `${tokens.sp16} ${tokens.sp32}`,
                  cursor: "pointer",
                  textDecoration: "none",
                  transition: "border-color 0.15s ease",
                }}
              >
                View itinerary
              </a>
            )}
          </div>
        </Container>
      </div>

      {/* ── Category filter strip ──────────────────────────────────────────── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          backgroundColor: tokens.warm,
          borderBottom: "1px solid rgba(26, 26, 24, 0.08)",
        }}
      >
        <Container>
          <div
            style={{
              display: "flex",
              gap: tokens.sp8,
              paddingBlock: tokens.sp12,
              overflowX: "auto",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {categories.map((cat) => {
              const isActive = selectedCategory === cat;
              const label =
                cat === "all" ? "All" : CATEGORY_DISPLAY[cat].label;

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    fontFamily: tokens.fontBody,
                    fontSize: tokens.textOverline,
                    fontWeight: 500,
                    lineHeight: "var(--leading-overline)",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    borderRadius: tokens.radiusButton,
                    padding: "6px 12px",
                    border: isActive
                      ? `1px solid ${tokens.ink}`
                      : "1px solid rgba(26, 26, 24, 0.25)",
                    backgroundColor: isActive ? tokens.ink : "transparent",
                    color: isActive ? tokens.warm : tokens.ink,
                    WebkitAppearance: "none",
                    appearance: "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease",
                    flexShrink: 0,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Container>
      </div>

      {/* ── Personalisation banner ────────────────────────────────────────── */}
      {preferences && !bannerDismissed && (
        <Container>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: tokens.sp16,
              padding: `${tokens.sp12} ${tokens.sp16}`,
              backgroundColor: `color-mix(in srgb, ${tokens.gold} 8%, transparent)`,
              border: `1px solid color-mix(in srgb, ${tokens.gold} 25%, transparent)`,
              borderRadius: tokens.radiusButton,
            }}
          >
            <p
              style={{
                fontFamily: tokens.fontBody,
                fontSize: tokens.textCaption,
                lineHeight: "var(--leading-caption)",
                color: tokens.ink,
                margin: 0,
              }}
            >
              Showing results for your trip &middot;{" "}
              <a
                href="/krakow/plan"
                style={{
                  color: tokens.ink,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Adjust →
              </a>
            </p>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss personalisation banner"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: tokens.fontBody,
                fontSize: tokens.textCaption,
                color: tokens.ink,
                opacity: 0.5,
                padding: `0 0 0 ${tokens.sp12}`,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        </Container>
      )}

      {/* ── Section header ─────────────────────────────────────────────────── */}
      <Container>
        <SectionSpacer size="md" />
        <h2
          style={{
            fontFamily: tokens.fontBody,
            fontSize: tokens.textHeadingLg,
            fontWeight: 600,
            lineHeight: "var(--leading-heading-lg)",
            color: tokens.ink,
            margin: 0,
          }}
        >
          {sectionTitle}
        </h2>
        <p
          style={{
            fontFamily: tokens.fontBody,
            fontSize: tokens.textCaption,
            lineHeight: "var(--leading-caption)",
            color: tokens.ink,
            opacity: 0.5,
            margin: `${tokens.sp4} 0 0 0`,
          }}
        >
          {countLabel}
        </p>
        <SectionSpacer size="sm" />
      </Container>

      {/* ── Entry grid ─────────────────────────────────────────────────────── */}
      <Container>
        {filtered.length === 0 ? (
          <Container narrow style={{ textAlign: "center" }}>
            <p
              style={{
                fontFamily: tokens.fontBody,
                fontSize: tokens.textBodyMd,
                lineHeight: "var(--leading-body-md)",
                color: tokens.ink,
                opacity: 0.5,
              }}
            >
              Nothing here yet. More coming soon.
            </p>
          </Container>
        ) : (
          <Grid>
            {filtered.map((se) => (
              <EntryCard key={se.entry.id} entry={se.entry} />
            ))}
          </Grid>
        )}
      </Container>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <SectionSpacer size="xl" />
      <Container>
        <p
          style={{
            fontFamily: tokens.fontBody,
            fontSize: tokens.textCaption,
            lineHeight: "var(--leading-caption)",
            color: tokens.ink,
            opacity: 0.4,
            textAlign: "center",
            margin: 0,
          }}
        >
          Sonder · Kraków · Updated March 2026
        </p>
      </Container>
      <SectionSpacer size="md" />
    </main>
  );
}
