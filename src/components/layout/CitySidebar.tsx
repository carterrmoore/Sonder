"use client";

import { CATEGORY_DISPLAY, COLOR_GROUPS } from "@/pipeline/constants";
import type { Category } from "@/types/pipeline";

interface CitySidebarProps {
  cityName: string;
  tagline: string;
  categories: Array<Category | "all">;
  activeCategory: Category | "all";
  onCategoryChange: (cat: Category | "all") => void;
  preferenceActive?: boolean;
  hasItinerary?: boolean;
  onPlanTrip: () => void;
  onViewItinerary: () => void;
}

export default function CitySidebar({
  cityName,
  tagline,
  categories,
  activeCategory,
  onCategoryChange,
  preferenceActive,
  hasItinerary,
  onPlanTrip,
  onViewItinerary,
}: CitySidebarProps) {
  return (
    <>
      {/* City identity */}
      <div>
        <h1
          className="text-display-lg"
          style={{ color: "var(--color-ink)", margin: "0 0 var(--spacing-px-12)" }}
        >
          {cityName}
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-sm)",
            lineHeight: "var(--leading-body-sm)",
            color: "var(--color-ink)",
            opacity: 0.55,
            margin: 0,
          }}
        >
          {tagline}
        </p>
      </div>

      {/* Category navigation */}
      <nav>
        <div
          className="sonder-city-sidebar-nav"
          style={{ display: "flex", flexDirection: "column", gap: "2px" }}
        >
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            const label =
              cat === "all" ? "All" : CATEGORY_DISPLAY[cat as Category]?.label ?? cat;
            const colorGroup =
              cat === "all" ? null : CATEGORY_DISPLAY[cat as Category]?.colorGroup;
            const accentColor = colorGroup
              ? (COLOR_GROUPS[colorGroup]?.bg ?? null)
              : null;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryChange(cat)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--spacing-px-8)",
                  padding: "8px 12px",
                  border: "none",
                  borderRadius: "var(--radius-button)",
                  backgroundColor: isActive ? "rgba(26,26,24,0.06)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-body-sm)",
                  fontWeight: isActive ? 600 : 400,
                  color: "var(--color-ink)",
                  opacity: isActive ? 1 : 0.6,
                  transition: "all 120ms ease",
                  width: "100%",
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLButtonElement).style.opacity = "0.9";
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLButtonElement).style.opacity = "0.6";
                }}
              >
                {/* Accent dot */}
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: isActive
                      ? (accentColor ?? "var(--color-ink)")
                      : "transparent",
                    border: `1.5px solid ${accentColor ?? "var(--color-ink)"}`,
                    opacity: accentColor ? 1 : isActive ? 1 : 0.4,
                    flexShrink: 0,
                    transition: "background-color 120ms ease",
                  }}
                />
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Preference context */}
      {preferenceActive && (
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-caption)",
            lineHeight: "var(--leading-caption)",
            color: "var(--color-ink)",
            opacity: 0.45,
            margin: 0,
          }}
        >
          Filtered for your trip.{" "}
          <button
            type="button"
            onClick={onPlanTrip}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-caption)",
              color: "var(--color-ink)",
              opacity: 0.45,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Adjust
          </button>
        </p>
      )}

      {/* CTAs — push to bottom */}
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-px-8)",
        }}
      >
        <button
          type="button"
          onClick={onPlanTrip}
          style={{
            width: "100%",
            padding: "11px 16px",
            backgroundColor: "var(--color-gold)",
            color: "var(--color-ink)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-sm)",
            fontWeight: 600,
            border: "none",
            borderRadius: "var(--radius-button)",
            cursor: "pointer",
            letterSpacing: "0.02em",
          }}
        >
          Plan my trip
        </button>

        {hasItinerary && (
          <button
            type="button"
            onClick={onViewItinerary}
            style={{
              width: "100%",
              padding: "11px 16px",
              backgroundColor: "transparent",
              color: "var(--color-ink)",
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-body-sm)",
              fontWeight: 500,
              border: "1px solid rgba(26,26,24,0.25)",
              borderRadius: "var(--radius-button)",
              cursor: "pointer",
              letterSpacing: "0.02em",
            }}
          >
            View itinerary
          </button>
        )}
      </div>
    </>
  );
}
