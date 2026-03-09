"use client";

import { useState, useEffect, useMemo } from "react";
import { useItinerary } from "@/hooks/useItinerary";
import CategoryPill from "@/components/ui/CategoryPill";
import { CATEGORY_DISPLAY } from "@/pipeline/constants";
import type { EntryCardData } from "@/lib/entries";
import type { TripPreferences } from "@/types/preferences";
import type { TimeBlock } from "@/types/itinerary";
import type { Category } from "@/types/pipeline";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TRIP_LENGTH_OPTIONS: Array<{ label: string; value: number }> = [
  { label: "2 days",   value: 2 },
  { label: "3–4 days", value: 3 },
  { label: "5–7 days", value: 5 },
  { label: "8+ days",  value: 8 },
];

const TIME_BLOCKS: TimeBlock[] = ["morning", "afternoon", "evening"];

const TIME_BLOCK_LABEL: Record<TimeBlock, string> = {
  morning:   "Morning",
  afternoon: "Afternoon",
  evening:   "Evening",
};

const CATEGORY_PLURAL: Record<Category, string> = {
  restaurant:    "Restaurants",
  cafe:          "Cafés",
  accommodation: "Accommodation",
  tour:          "Experiences",
  sight:         "Sights",
  nightlife:     "Nightlife",
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface SetupTileProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

function SetupTile({ label, selected, onClick }: SetupTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: selected
          ? "2px solid var(--color-gold)"
          : "1px solid rgba(245, 240, 232, 0.20)",
        backgroundColor: selected
          ? "rgba(196, 154, 60, 0.10)"
          : "transparent",
        borderRadius: "var(--radius-card)",
        padding: "var(--spacing-px-16) var(--spacing-px-20)",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        transition: "border-color 0.15s ease, background-color 0.15s ease",
      }}
    >
      <span
        style={{
          display: "block",
          fontFamily: "var(--font-body)",
          fontWeight: 600,
          fontSize: "var(--text-body-md)",
          lineHeight: "var(--leading-body-md)",
          color: "var(--color-warm)",
        }}
      >
        {label}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper — format ISO date for display
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function nightsBetween(arrival: string, departure: string): number {
  const a = new Date(arrival).getTime();
  const b = new Date(departure).getTime();
  return Math.max(1, Math.round((b - a) / 86400000));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface ItineraryBuilderProps {
  citySlug: string;
  entries: EntryCardData[];
}

export default function ItineraryBuilder({ citySlug, entries }: ItineraryBuilderProps) {
  const { itinerary, initItinerary, addEntry, removeEntry } = useItinerary(citySlug);

  const [preferences, setPreferences] = useState<TripPreferences | null>(null);
  const [selectedTripLength, setSelectedTripLength] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [activeTimeBlock, setActiveTimeBlock] = useState<TimeBlock>("morning");
  const [browserCategory, setBrowserCategory] = useState<Category | "all">("all");
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`sonder_preferences_${citySlug}`);
      if (raw) setPreferences(JSON.parse(raw) as TripPreferences);
    } catch {}
  }, [citySlug]);

  // Derive trip length from specific dates if available
  const derivedTripLength = useMemo(() => {
    if (!preferences) return null;
    if (preferences.arrival && preferences.departure && !preferences.datesFlexible) {
      return nightsBetween(preferences.arrival, preferences.departure);
    }
    return null;
  }, [preferences]);

  const hasSpecificDates = !!derivedTripLength;
  const resolvedTripLength = derivedTripLength ?? selectedTripLength;

  // Category list for browser filter
  const categories = useMemo(() => {
    return ["all" as const, ...Array.from(new Set(entries.map((e) => e.category)))];
  }, [entries]);

  // Filtered browser entries
  const browserEntries = useMemo(() => {
    return browserCategory === "all"
      ? entries
      : entries.filter((e) => e.category === browserCategory);
  }, [entries, browserCategory]);

  // Set of entry IDs already in the itinerary
  const addedEntryIds = useMemo(() => {
    if (!itinerary) return new Set<string>();
    return new Set(itinerary.days.flatMap((d) => d.slots.map((s) => s.entryId)));
  }, [itinerary]);

  // ── State A — empty / setup ──────────────────────────────────────────────

  if (!itinerary) {
    const canStart = hasSpecificDates || selectedTripLength !== null;

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "var(--color-ink)",
          overflow: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingBlock: "var(--spacing-px-96)",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "560px",
            paddingInline: "var(--spacing-px-24)",
          }}
        >
          <h1
            className="text-display-md"
            style={{ color: "var(--color-warm)", margin: "0 0 var(--spacing-px-32) 0" }}
          >
            Plan your Kraków.
          </h1>

          {hasSpecificDates && preferences?.arrival && preferences?.departure ? (
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body-md)",
                lineHeight: "var(--leading-body-md)",
                color: "var(--color-warm)",
                opacity: 0.7,
                margin: "0 0 var(--spacing-px-32) 0",
              }}
            >
              Your trip: {formatDate(preferences.arrival)} → {formatDate(preferences.departure)} · {derivedTripLength} night{derivedTripLength !== 1 ? "s" : ""}
            </p>
          ) : (
            <>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-body-md)",
                  lineHeight: "var(--leading-body-md)",
                  color: "var(--color-warm)",
                  opacity: 0.7,
                  margin: "0 0 var(--spacing-px-24) 0",
                }}
              >
                How long are you staying?
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--spacing-px-12)",
                  marginBottom: "var(--spacing-px-32)",
                }}
              >
                {TRIP_LENGTH_OPTIONS.map(({ label, value }) => (
                  <SetupTile
                    key={value}
                    label={label}
                    selected={selectedTripLength === value}
                    onClick={() => setSelectedTripLength(value)}
                  />
                ))}
              </div>
            </>
          )}

          <button
            type="button"
            disabled={!canStart}
            onClick={() => {
              if (!resolvedTripLength) return;
              initItinerary(resolvedTripLength, preferences?.arrival ?? null);
            }}
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              fontSize: "var(--text-body-md)",
              backgroundColor: canStart
                ? "var(--color-gold)"
                : "rgba(196, 154, 60, 0.25)",
              color: canStart ? "var(--color-ink)" : "rgba(26, 26, 24, 0.40)",
              border: "none",
              borderRadius: "var(--radius-button)",
              padding: "var(--spacing-px-16) var(--spacing-px-32)",
              cursor: canStart ? "pointer" : "not-allowed",
              width: "100%",
              transition: "background-color 0.2s ease, color 0.2s ease",
            }}
          >
            Start building →
          </button>

          <a
            href={`/${citySlug}`}
            style={{
              display: "block",
              marginTop: "var(--spacing-px-16)",
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-body-sm)",
              color: "var(--color-warm)",
              opacity: 0.5,
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            ← Back to guide
          </a>
        </div>
      </div>
    );
  }

  // ── State B — timeline view ──────────────────────────────────────────────

  const currentDay = itinerary.days.find((d) => d.dayNumber === selectedDay) ?? itinerary.days[0];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--color-warm)" }}>

      {/* ── Nav bar ───────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          backgroundColor: "var(--color-warm)",
          borderBottom: "1px solid rgba(26, 26, 24, 0.08)",
          padding: "var(--spacing-px-12) var(--spacing-px-24)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--spacing-px-16)",
        }}
      >
        <a
          href={`/${citySlug}`}
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-sm)",
            color: "var(--color-ink)",
            opacity: 0.5,
            textDecoration: "none",
          }}
        >
          ← Kraków guide
        </a>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            fontSize: "var(--text-body-sm)",
            color: "var(--color-ink)",
            margin: 0,
          }}
        >
          Your itinerary · {itinerary.tripLength} day{itinerary.tripLength !== 1 ? "s" : ""}
        </p>
      </div>

      {/* ── Day tab strip ─────────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: "var(--color-warm)",
          borderBottom: "1px solid rgba(26, 26, 24, 0.08)",
          paddingInline: "var(--spacing-px-24)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "var(--spacing-px-8)",
            paddingBlock: "var(--spacing-px-12)",
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          {itinerary.days.map((d) => {
            const active = d.dayNumber === selectedDay;
            return (
              <button
                key={d.dayNumber}
                type="button"
                onClick={() => setSelectedDay(d.dayNumber)}
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-overline)",
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  borderRadius: "var(--radius-button)",
                  padding: "6px 12px",
                  border: active
                    ? "1px solid var(--color-ink)"
                    : "1px solid rgba(26, 26, 24, 0.25)",
                  backgroundColor: active ? "var(--color-ink)" : "transparent",
                  color: active ? "var(--color-warm)" : "var(--color-ink)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  transition: "background-color 0.15s ease, color 0.15s ease",
                }}
              >
                Day {d.dayNumber}
                {d.date && (
                  <span style={{ opacity: 0.6, fontWeight: 400 }}>
                    {" "}
                    · {new Date(d.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main layout ───────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          maxWidth: "1280px",
          margin: "0 auto",
          paddingInline: "var(--spacing-px-24)",
          paddingBlock: "var(--spacing-px-32)",
          gap: "var(--spacing-px-40)",
        }}
        className="itinerary-layout"
      >

        {/* ── Left: Day timeline ──────────────────────────────────────────── */}
        <div style={{ minWidth: 0 }}>
          {TIME_BLOCKS.map((block) => {
            const slots = currentDay.slots.filter((s) => s.timeBlock === block);
            const isActive = activeTimeBlock === block;

            return (
              <div key={block} style={{ marginBottom: "var(--spacing-px-32)" }}>
                {/* Time block header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "var(--spacing-px-12)",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--text-overline)",
                      fontWeight: 500,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--color-ink)",
                      opacity: 0.5,
                      margin: 0,
                    }}
                  >
                    {TIME_BLOCK_LABEL[block]}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTimeBlock(block);
                      setMobileSheetOpen(true);
                    }}
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--text-caption)",
                      fontWeight: 500,
                      color: "var(--color-ink)",
                      opacity: 0.5,
                      background: "none",
                      border: "1px solid rgba(26, 26, 24, 0.25)",
                      borderRadius: "var(--radius-button)",
                      padding: "4px 10px",
                      cursor: "pointer",
                    }}
                  >
                    + Add
                  </button>
                </div>

                {/* Slot list */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--spacing-px-8)",
                  }}
                >
                  {slots.length === 0 ? (
                    <div
                      style={{
                        border: "1px dashed rgba(26, 26, 24, 0.20)",
                        borderRadius: "var(--radius-card)",
                        padding: "var(--spacing-px-16)",
                        textAlign: "center",
                      }}
                    >
                      <p
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: "var(--text-caption)",
                          lineHeight: "var(--leading-caption)",
                          color: "var(--color-ink)",
                          opacity: 0.4,
                          margin: 0,
                        }}
                      >
                        Nothing planned yet
                      </p>
                    </div>
                  ) : (
                    slots.map((slot) => (
                      <div
                        key={slot.id}
                        style={{
                          backgroundColor: "white",
                          borderRadius: "var(--radius-card)",
                          boxShadow: "var(--shadow-card-rest)",
                          padding: "var(--spacing-px-16)",
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: "var(--spacing-px-12)",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <p
                            style={{
                              fontFamily: "var(--font-body)",
                              fontWeight: 600,
                              fontSize: "var(--text-body-md)",
                              lineHeight: "var(--leading-body-md)",
                              color: "var(--color-ink)",
                              margin: "0 0 var(--spacing-px-4) 0",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {slot.entrySnapshot.name}
                          </p>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "var(--spacing-px-8)",
                              flexWrap: "wrap",
                            }}
                          >
                            {slot.entrySnapshot.neighbourhood && (
                              <span
                                style={{
                                  fontFamily: "var(--font-body)",
                                  fontSize: "var(--text-caption)",
                                  lineHeight: "var(--leading-caption)",
                                  color: "var(--color-ink)",
                                  opacity: 0.5,
                                }}
                              >
                                {slot.entrySnapshot.neighbourhood}
                              </span>
                            )}
                            <CategoryPill
                              category={slot.entrySnapshot.category as Category}
                              size="sm"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeEntry(slot.id)}
                          aria-label={`Remove ${slot.entrySnapshot.name}`}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--color-ink)",
                            opacity: 0.35,
                            padding: "2px",
                            flexShrink: 0,
                            lineHeight: 1,
                            fontSize: "18px",
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Right: Entry browser ────────────────────────────────────────── */}
        <div
          className="entry-browser"
          style={{
            borderTop: "1px solid rgba(26, 26, 24, 0.08)",
            paddingTop: "var(--spacing-px-32)",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              fontSize: "var(--text-heading-lg)",
              lineHeight: "var(--leading-heading-lg)",
              color: "var(--color-ink)",
              margin: "0 0 var(--spacing-px-16) 0",
            }}
          >
            Add to your trip
          </h2>

          {/* Active day + time block label */}
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-caption)",
              color: "var(--color-ink)",
              opacity: 0.5,
              margin: "0 0 var(--spacing-px-16) 0",
            }}
          >
            Adding to Day {selectedDay} · {TIME_BLOCK_LABEL[activeTimeBlock]}
          </p>

          {/* Category filter pills */}
          <div
            style={{
              display: "flex",
              gap: "var(--spacing-px-8)",
              flexWrap: "wrap",
              marginBottom: "var(--spacing-px-16)",
            }}
          >
            {categories.map((cat) => {
              const isActive = browserCategory === cat;
              const label = cat === "all" ? "All" : CATEGORY_DISPLAY[cat].label;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setBrowserCategory(cat)}
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--text-overline)",
                    fontWeight: 500,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    borderRadius: "var(--radius-button)",
                    padding: "4px 10px",
                    border: isActive
                      ? "1px solid var(--color-ink)"
                      : "1px solid rgba(26, 26, 24, 0.25)",
                    backgroundColor: isActive ? "var(--color-ink)" : "transparent",
                    color: isActive ? "var(--color-warm)" : "var(--color-ink)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "background-color 0.15s ease, color 0.15s ease",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Entry list */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--spacing-px-8)",
            }}
          >
            {browserEntries.map((entry) => {
              const added = addedEntryIds.has(entry.id);
              return (
                <div
                  key={entry.id}
                  style={{
                    backgroundColor: "white",
                    borderRadius: "var(--radius-card)",
                    boxShadow: "var(--shadow-card-rest)",
                    padding: "var(--spacing-px-12) var(--spacing-px-16)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--spacing-px-12)",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p
                      style={{
                        fontFamily: "var(--font-body)",
                        fontWeight: 600,
                        fontSize: "var(--text-body-md)",
                        lineHeight: "var(--leading-body-md)",
                        color: "var(--color-ink)",
                        margin: "0 0 var(--spacing-px-4) 0",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {entry.name}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--spacing-px-8)",
                        marginBottom: entry.editorial_hook ? "var(--spacing-px-4)" : 0,
                      }}
                    >
                      {entry.neighbourhood && (
                        <span
                          style={{
                            fontFamily: "var(--font-body)",
                            fontSize: "var(--text-caption)",
                            color: "var(--color-ink)",
                            opacity: 0.5,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {entry.neighbourhood}
                        </span>
                      )}
                      <CategoryPill category={entry.category} size="sm" />
                    </div>
                    {entry.editorial_hook && (
                      <p
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: "var(--text-body-sm)",
                          lineHeight: "var(--leading-body-sm)",
                          color: "var(--color-ink)",
                          opacity: 0.6,
                          margin: 0,
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 1,
                          overflow: "hidden",
                        }}
                      >
                        {entry.editorial_hook}
                      </p>
                    )}
                  </div>

                  {added ? (
                    <button
                      type="button"
                      onClick={() => {
                        // Find and remove the slot for this entry
                        if (!itinerary) return;
                        const slot = itinerary.days
                          .flatMap((d) => d.slots)
                          .find((s) => s.entryId === entry.id);
                        if (slot) removeEntry(slot.id);
                      }}
                      title="Remove from itinerary"
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "var(--text-caption)",
                        fontWeight: 500,
                        color: "var(--color-gold)",
                        background: "none",
                        border: "1px solid var(--color-gold)",
                        borderRadius: "var(--radius-button)",
                        padding: "4px 10px",
                        cursor: "pointer",
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                      }}
                    >
                      ✓ Added
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addEntry(entry, selectedDay, activeTimeBlock)}
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "var(--text-caption)",
                        fontWeight: 500,
                        color: "var(--color-ink)",
                        background: "none",
                        border: "1px solid rgba(26, 26, 24, 0.35)",
                        borderRadius: "var(--radius-button)",
                        padding: "4px 10px",
                        cursor: "pointer",
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                        transition: "border-color 0.15s ease",
                      }}
                    >
                      + Add
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Mobile bottom sheet backdrop ──────────────────────────────────── */}
      {mobileSheetOpen && (
        <div
          onClick={() => setMobileSheetOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(26, 26, 24, 0.4)",
            zIndex: 30,
          }}
          className="mobile-sheet-backdrop"
        />
      )}

      {/* ── Responsive layout styles ──────────────────────────────────────── */}
      <style>{`
        @media (min-width: 900px) {
          .itinerary-layout {
            grid-template-columns: 65fr 35fr !important;
            align-items: start;
          }
          .entry-browser {
            border-top: none !important;
            padding-top: 0 !important;
            position: sticky;
            top: 113px;
            max-height: calc(100vh - 130px);
            overflow-y: auto;
          }
          .mobile-sheet-backdrop {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
