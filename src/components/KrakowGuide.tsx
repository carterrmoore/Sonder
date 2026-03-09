"use client";

import { useState } from "react";
import Container from "@/components/ui/Container";
import Grid from "@/components/ui/Grid";
import SectionSpacer from "@/components/ui/SectionSpacer";
import EntryCard from "@/components/EntryCard";
import { CATEGORY_DISPLAY } from "@/pipeline/constants";
import type { EntryCardData } from "@/lib/entries";
import type { Category } from "@/types/pipeline";

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

  const categories = [
    "all" as const,
    ...Array.from(new Set(entries.map((e) => e.category))),
  ];

  const filtered =
    selectedCategory === "all"
      ? entries
      : entries.filter((e) => e.category === selectedCategory);

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
            {filtered.map((entry) => (
              <EntryCard key={entry.id} entry={entry} citySlug="krakow" />
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
