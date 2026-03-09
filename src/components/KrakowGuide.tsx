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
    <main style={{ minHeight: "100vh", backgroundColor: "var(--color-warm)" }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: "var(--color-ink)",
          minHeight: "70vh",
          display: "flex",
          alignItems: "center",
          paddingBlock: "var(--spacing-px-80)",
        }}
      >
        <Container narrow>
          {/* Overline */}
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-overline)",
              fontWeight: 500,
              lineHeight: "var(--leading-overline)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-gold)",
              margin: "0 0 var(--spacing-px-16) 0",
            }}
          >
            Kraków, Poland
          </p>

          {/* Display headline */}
          <h1
            className="text-display-xl"
            style={{
              color: "var(--color-warm)",
              margin: "0 0 var(--spacing-px-24) 0",
            }}
          >
            A city that rewards the unhurried.
          </h1>

          {/* Subheading */}
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-body-lg)",
              lineHeight: "var(--leading-body-lg)",
              color: "var(--color-warm)",
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
              gap: "var(--spacing-px-12)",
              flexWrap: "wrap",
              marginTop: "var(--spacing-px-24)",
            }}
          >
            <a
              href="/krakow/plan"
              style={{
                display: "inline-block",
                fontFamily: "var(--font-body)",
                fontWeight: 600,
                fontSize: "var(--text-body-md)",
                backgroundColor: "var(--color-gold)",
                color: "var(--color-ink)",
                border: "none",
                borderRadius: "var(--radius-button)",
                padding: "var(--spacing-px-16) var(--spacing-px-32)",
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
                  fontFamily: "var(--font-body)",
                  fontWeight: 600,
                  fontSize: "var(--text-body-md)",
                  backgroundColor: "transparent",
                  color: "var(--color-warm)",
                  border: "1px solid rgba(245, 240, 232, 0.35)",
                  borderRadius: "var(--radius-button)",
                  padding: "var(--spacing-px-16) var(--spacing-px-32)",
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
          backgroundColor: "var(--color-warm)",
          borderBottom: "1px solid rgba(26, 26, 24, 0.08)",
        }}
      >
        <Container>
          <div
            style={{
              display: "flex",
              gap: "var(--spacing-px-8)",
              paddingBlock: "var(--spacing-px-12)",
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
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--text-overline)",
                    fontWeight: 500,
                    lineHeight: "var(--leading-overline)",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    borderRadius: "var(--radius-button)",
                    padding: "6px 12px",
                    border: isActive
                      ? "1px solid var(--color-ink)"
                      : "1px solid rgba(26, 26, 24, 0.25)",
                    backgroundColor: isActive
                      ? "var(--color-ink)"
                      : "transparent",
                    color: isActive ? "var(--color-warm)" : "var(--color-ink)",
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
              marginTop: "var(--spacing-px-16)",
              padding: "var(--spacing-px-12) var(--spacing-px-16)",
              backgroundColor: "color-mix(in srgb, var(--color-gold) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--color-gold) 25%, transparent)",
              borderRadius: "var(--radius-button)",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-caption)",
                lineHeight: "var(--leading-caption)",
                color: "var(--color-ink)",
                margin: 0,
              }}
            >
              Showing results for your trip &middot;{" "}
              <a
                href="/krakow/plan"
                style={{
                  color: "var(--color-ink)",
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
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-caption)",
                color: "var(--color-ink)",
                opacity: 0.5,
                padding: "0 0 0 var(--spacing-px-12)",
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
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-heading-lg)",
            fontWeight: 600,
            lineHeight: "var(--leading-heading-lg)",
            color: "var(--color-ink)",
            margin: 0,
          }}
        >
          {sectionTitle}
        </h2>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-caption)",
            lineHeight: "var(--leading-caption)",
            color: "var(--color-ink)",
            opacity: 0.5,
            margin: "var(--spacing-px-4) 0 0 0",
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
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body-md)",
                lineHeight: "var(--leading-body-md)",
                color: "var(--color-ink)",
                opacity: 0.5,
              }}
            >
              Nothing here yet. More coming soon.
            </p>
          </Container>
        ) : (
          <Grid>
            {filtered.map((se) => (
              <EntryCard key={se.entry.id} entry={se.entry} citySlug="krakow" />
            ))}
          </Grid>
        )}
      </Container>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <SectionSpacer size="xl" />
      <Container>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-caption)",
            lineHeight: "var(--leading-caption)",
            color: "var(--color-ink)",
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
