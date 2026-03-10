"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { ArrowLeftRight } from "lucide-react";
import { useItinerary } from "@/hooks/useItinerary";
import { useRouter } from "next/navigation";
import CategoryPill from "@/components/ui/CategoryPill";
import SwapDrawer from "@/components/SwapDrawer";
import ItinerarySummary from "@/components/ItinerarySummary";
import { CATEGORY_DISPLAY } from "@/pipeline/constants";
import { applyPreferences } from "@/lib/preference-filter";
import type { ScoredEntry } from "@/lib/preference-filter";
import type { EntryCardData } from "@/lib/entries";
import type { TripPreferences } from "@/types/preferences";
import type { ItinerarySlot, TimeBlock } from "@/types/itinerary";
import type { Category } from "@/types/pipeline";
import { tokens } from "@/lib/tokens";

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
          ? `2px solid ${tokens.gold}`
          : "1px solid rgba(245, 240, 232, 0.20)",
        backgroundColor: selected ? "rgba(196, 154, 60, 0.10)" : "transparent",
        WebkitAppearance: "none",
        appearance: "none",
        borderRadius: tokens.radiusCard,
        padding: `${tokens.sp16} 20px`,
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        transition: "border-color 0.15s ease, background-color 0.15s ease",
      }}
    >
      <span
        style={{
          display: "block",
          fontFamily: tokens.fontBody,
          fontWeight: 600,
          fontSize: tokens.textBodyMd,
          lineHeight: "var(--leading-body-md)",
          color: tokens.warm,
        }}
      >
        {label}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
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

function buildAlternatives(
  slot: ItinerarySlot,
  scoredEntries: ScoredEntry[],
  addedEntryIds: Set<string>
): ScoredEntry[] {
  const origNeighbourhood = slot.entrySnapshot.neighbourhood;

  const available = scoredEntries.filter(
    (se) =>
      se.entry.id !== slot.entryId &&
      !addedEntryIds.has(se.entry.id) &&
      se.entry.category !== "accommodation"
  );

  // Same neighbourhood first, sorted by score desc
  const sameNeighbourhood = available.filter(
    (se) => se.entry.neighbourhood === origNeighbourhood && origNeighbourhood
  );
  const otherNeighbourhood = available.filter(
    (se) => se.entry.neighbourhood !== origNeighbourhood || !origNeighbourhood
  );

  const merged = [...sameNeighbourhood, ...otherNeighbourhood];
  return merged.slice(0, 4);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface ItineraryBuilderProps {
  citySlug: string;
  entries: EntryCardData[];
}

export default function ItineraryBuilder({ citySlug, entries }: ItineraryBuilderProps) {
  const {
    itinerary,
    initItinerary,
    addEntry,
    removeEntry,
    swapEntry,
    finaliseItinerary,
  } = useItinerary(citySlug);
  const router = useRouter();

  const [preferences, setPreferences] = useState<TripPreferences | null>(null);
  const [selectedTripLength, setSelectedTripLength] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [activeTimeBlock, setActiveTimeBlock] = useState<TimeBlock>("morning");
  const [browserCategory, setBrowserCategory] = useState<Category | "all">("all");
  const [swapTarget, setSwapTarget] = useState<ItinerarySlot | null>(null);
  // Set of day numbers the user has confirmed
  const [confirmedDays, setConfirmedDays] = useState<Set<number>>(new Set());
  const [showSummary, setShowSummary] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`sonder_preferences_${citySlug}`);
      if (raw) setPreferences(JSON.parse(raw) as TripPreferences);
    } catch {}
  }, [citySlug]);

  // Score all entries once — passed into initItinerary and used for swap alternatives
  const scoredEntries = useMemo(
    () => applyPreferences(entries, preferences),
    [entries, preferences]
  );

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
  const categories = useMemo(
    () => ["all" as const, ...Array.from(new Set(entries.map((e) => e.category)))],
    [entries]
  );

  // Filtered browser entries — sorted by preference score (applyPreferences returns desc)
  const filteredBrowserEntries = useMemo(
    () =>
      browserCategory === "all"
        ? scoredEntries
        : scoredEntries.filter((se) => se.entry.category === browserCategory),
    [scoredEntries, browserCategory]
  );

  // Set of entry IDs placed in the itinerary across ALL days
  const addedEntryIds = useMemo(() => {
    if (!itinerary) return new Set<string>();
    return new Set(
      itinerary.days.flatMap((d) => d.slots.map((s) => s.entryId).filter(Boolean))
    );
  }, [itinerary]);

  // Alias — used when passed to SwapDrawer
  const placedEntryIds = addedEntryIds;

  // Check if all days are confirmed — triggers summary after short delay
  useEffect(() => {
    if (!itinerary) return;
    const allConfirmed =
      confirmedDays.size === itinerary.tripLength &&
      itinerary.days.every((d) => confirmedDays.has(d.dayNumber));
    if (allConfirmed && itinerary.tripLength > 0) {
      confirmTimerRef.current = setTimeout(() => setShowSummary(true), 600);
    }
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, [confirmedDays, itinerary]);

  const handleConfirmDay = useCallback((dayNumber: number) => {
    setConfirmedDays((prev) => new Set([...prev, dayNumber]));
  }, []);

  const handleBackToEdit = useCallback(() => {
    setShowSummary(false);
    setConfirmedDays(new Set());
  }, []);

  const handleSave = useCallback(() => {
    finaliseItinerary();
    router.push(`/${citySlug}`);
  }, [finaliseItinerary, router, citySlug]);

  // ── Inert background when swap drawer is open ────────────────────────────
  const mainRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mainRef.current) return;
    if (swapTarget) {
      mainRef.current.setAttribute("inert", "");
    } else {
      mainRef.current.removeAttribute("inert");
    }
  }, [swapTarget]);

  // ── Swap alternatives ────────────────────────────────────────────────────
  // Exclude all placed entries across all days, not just the current day.
  const swapAlternatives = useMemo(() => {
    if (!swapTarget) return [];
    const origNeighbourhood = swapTarget.entrySnapshot.neighbourhood;
    const available = scoredEntries.filter(
      (se) =>
        se.entry.id !== swapTarget.entryId &&
        !placedEntryIds.has(se.entry.id) &&
        se.entry.category !== "accommodation"
    );
    const sameNeighbourhood = available.filter(
      (se) => se.entry.neighbourhood === origNeighbourhood && origNeighbourhood
    );
    const other = available.filter(
      (se) => se.entry.neighbourhood !== origNeighbourhood || !origNeighbourhood
    );
    return [...sameNeighbourhood, ...other].slice(0, 8);
  }, [swapTarget, scoredEntries, placedEntryIds]);

  // ── State A — empty / setup ──────────────────────────────────────────────
  if (!itinerary) {
    const canStart = hasSpecificDates || selectedTripLength !== null;

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: tokens.ink,
          overflow: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingBlock: tokens.sp96,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "560px",
            paddingInline: tokens.sp24,
          }}
        >
          <h1
            className="text-display-md"
            style={{ color: tokens.warm, margin: `0 0 ${tokens.sp32} 0` }}
          >
            Plan your Kraków.
          </h1>

          {hasSpecificDates && preferences?.arrival && preferences?.departure ? (
            <p
              style={{
                fontFamily: tokens.fontBody,
                fontSize: tokens.textBodyMd,
                lineHeight: "var(--leading-body-md)",
                color: tokens.warm,
                opacity: 0.7,
                margin: `0 0 ${tokens.sp32} 0`,
              }}
            >
              Your trip: {formatDate(preferences.arrival)} →{" "}
              {formatDate(preferences.departure)} · {derivedTripLength} night
              {derivedTripLength !== 1 ? "s" : ""}
            </p>
          ) : (
            <>
              <p
                style={{
                  fontFamily: tokens.fontBody,
                  fontSize: tokens.textBodyMd,
                  lineHeight: "var(--leading-body-md)",
                  color: tokens.warm,
                  opacity: 0.7,
                  margin: `0 0 ${tokens.sp24} 0`,
                }}
              >
                How long are you staying?
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: tokens.sp12,
                  marginBottom: tokens.sp32,
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
              console.log('initItinerary called', {
                tripLength: resolvedTripLength,
                scoredEntriesCount: scoredEntries.length,
                firstEntry: scoredEntries[0]?.entry?.name,
              });
              initItinerary(
                resolvedTripLength,
                preferences?.arrival ?? null,
                scoredEntries
              );
            }}
            style={{
              fontFamily: tokens.fontBody,
              fontWeight: 600,
              fontSize: tokens.textBodyMd,
              backgroundColor: canStart ? tokens.gold : "rgba(196, 154, 60, 0.25)",
              color: canStart ? tokens.ink : "rgba(26, 26, 24, 0.40)",
              border: "none",
              WebkitAppearance: "none",
              appearance: "none",
              borderRadius: tokens.radiusButton,
              padding: `${tokens.sp16} ${tokens.sp32}`,
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
              marginTop: tokens.sp16,
              fontFamily: tokens.fontBody,
              fontSize: tokens.textBodySm,
              color: tokens.warm,
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

  // ── State C — summary screen ─────────────────────────────────────────────
  if (showSummary) {
    return (
      <ItinerarySummary
        itinerary={itinerary}
        totalEntryCount={entries.length}
        onSave={handleSave}
        onBackToEdit={handleBackToEdit}
      />
    );
  }

  // ── State B — timeline view ──────────────────────────────────────────────
  const currentDay =
    itinerary.days.find((d) => d.dayNumber === selectedDay) ?? itinerary.days[0];

  return (
    <>
      <div
        ref={mainRef}
        style={{ minHeight: "100vh", backgroundColor: tokens.warm }}
      >
        {/* ── Nav bar ─────────────────────────────────────────────────────── */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            backgroundColor: tokens.warm,
            borderBottom: "1px solid rgba(26, 26, 24, 0.08)",
            padding: `${tokens.sp12} ${tokens.sp24}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: tokens.sp16,
          }}
        >
          <a
            href={`/${citySlug}`}
            style={{
              fontFamily: tokens.fontBody,
              fontSize: tokens.textBodySm,
              color: tokens.ink,
              opacity: 0.5,
              textDecoration: "none",
            }}
          >
            ← Kraków guide
          </a>
          <p
            style={{
              fontFamily: tokens.fontBody,
              fontWeight: 600,
              fontSize: tokens.textBodySm,
              color: tokens.ink,
              margin: 0,
            }}
          >
            Your itinerary · {itinerary.tripLength} day
            {itinerary.tripLength !== 1 ? "s" : ""}
          </p>
        </div>

        {/* ── Day tab strip ───────────────────────────────────────────────── */}
        <div
          style={{
            backgroundColor: tokens.warm,
            borderBottom: "1px solid rgba(26, 26, 24, 0.08)",
            paddingInline: tokens.sp24,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: tokens.sp8,
              paddingBlock: tokens.sp12,
              overflowX: "auto",
              scrollbarWidth: "none",
            }}
          >
            {itinerary.days.map((d) => {
              const active = d.dayNumber === selectedDay;
              const confirmed = confirmedDays.has(d.dayNumber);
              return (
                <button
                  key={d.dayNumber}
                  type="button"
                  onClick={() => setSelectedDay(d.dayNumber)}
                  style={{
                    fontFamily: tokens.fontBody,
                    fontSize: tokens.textOverline,
                    fontWeight: 500,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    borderRadius: tokens.radiusButton,
                    padding: "6px 12px",
                    border: active
                      ? `1px solid ${tokens.ink}`
                      : "1px solid rgba(26, 26, 24, 0.25)",
                    backgroundColor: active
                      ? tokens.ink
                      : confirmed
                      ? "rgba(196, 154, 60, 0.12)"
                      : "transparent",
                    color: active ? tokens.warm : tokens.ink,
                    WebkitAppearance: "none",
                    appearance: "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    transition: "background-color 0.15s ease, color 0.15s ease",
                  }}
                >
                  {confirmed && !active && "✓ "}
                  Day {d.dayNumber}
                  {d.date && (
                    <span style={{ opacity: 0.6, fontWeight: 400 }}>
                      {" "}
                      ·{" "}
                      {new Date(d.date + "T00:00:00").toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Main layout ─────────────────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            maxWidth: "1280px",
            margin: "0 auto",
            paddingInline: tokens.sp24,
            paddingBlock: tokens.sp32,
            gap: tokens.sp40,
          }}
          className="itinerary-layout"
        >
          {/* ── Left: Day timeline ────────────────────────────────────────── */}
          <div style={{ minWidth: 0 }}>
            {TIME_BLOCKS.map((block) => {
              const slots = currentDay.slots.filter((s) => s.timeBlock === block);

              return (
                <div key={block} style={{ marginBottom: tokens.sp32 }}>
                  {/* Time block header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: tokens.sp12,
                    }}
                  >
                    <p
                      style={{
                        fontFamily: tokens.fontBody,
                        fontSize: tokens.textOverline,
                        fontWeight: 500,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: tokens.ink,
                        opacity: 0.5,
                        margin: 0,
                      }}
                    >
                      {TIME_BLOCK_LABEL[block]}
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTimeBlock(block)}
                      style={{
                        fontFamily: tokens.fontBody,
                        fontSize: tokens.textCaption,
                        fontWeight: 500,
                        color: tokens.ink,
                        opacity: 0.5,
                        background: "none",
                        border: "1px solid rgba(26, 26, 24, 0.25)",
                        borderRadius: tokens.radiusButton,
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
                      gap: tokens.sp8,
                    }}
                  >
                    {slots.length === 0 ? (
                      <div
                        style={{
                          border: "1px dashed rgba(26, 26, 24, 0.20)",
                          borderRadius: tokens.radiusCard,
                          padding: tokens.sp16,
                          textAlign: "center",
                        }}
                      >
                        <p
                          style={{
                            fontFamily: tokens.fontBody,
                            fontSize: tokens.textCaption,
                            lineHeight: "var(--leading-caption)",
                            color: tokens.ink,
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
                            borderRadius: tokens.radiusCard,
                            boxShadow: tokens.shadowCardRest,
                            padding: tokens.sp16,
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: tokens.sp12,
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <p
                              style={{
                                fontFamily: tokens.fontBody,
                                fontWeight: 600,
                                fontSize: tokens.textBodyMd,
                                lineHeight: "var(--leading-body-md)",
                                color: tokens.ink,
                                margin: `0 0 ${tokens.sp4} 0`,
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
                                gap: tokens.sp8,
                                flexWrap: "wrap",
                              }}
                            >
                              {slot.entrySnapshot.neighbourhood && (
                                <span
                                  style={{
                                    fontFamily: tokens.fontBody,
                                    fontSize: tokens.textCaption,
                                    lineHeight: "var(--leading-caption)",
                                    color: tokens.ink,
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

                          {/* Slot actions */}
                          <div
                            style={{
                              display: "flex",
                              gap: tokens.sp4,
                              flexShrink: 0,
                            }}
                          >
                            {/* Swap */}
                            <button
                              type="button"
                              onClick={() => setSwapTarget(slot)}
                              aria-label={`Swap ${slot.entrySnapshot.name}`}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: tokens.ink,
                                opacity: 0.35,
                                padding: "4px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <ArrowLeftRight size={14} />
                            </button>
                            {/* Remove */}
                            <button
                              type="button"
                              onClick={() => removeEntry(slot.id)}
                              aria-label={`Remove ${slot.entrySnapshot.name}`}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: tokens.ink,
                                opacity: 0.35,
                                padding: "4px",
                                lineHeight: 1,
                                fontSize: "18px",
                                fontFamily: tokens.fontBody,
                              }}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}

            {/* ── Confirm Day button ───────────────────────────────────────── */}
            {!confirmedDays.has(currentDay.dayNumber) ? (
              <button
                type="button"
                onClick={() => handleConfirmDay(currentDay.dayNumber)}
                style={{
                  fontFamily: tokens.fontBody,
                  fontWeight: 600,
                  fontSize: tokens.textBodyMd,
                  backgroundColor: tokens.ink,
                  color: tokens.warm,
                  border: "none",
                  WebkitAppearance: "none",
                  appearance: "none",
                  borderRadius: tokens.radiusButton,
                  padding: `${tokens.sp16} ${tokens.sp32}`,
                  cursor: "pointer",
                  width: "100%",
                  marginTop: tokens.sp8,
                  transition: "opacity 0.15s ease",
                }}
              >
                Confirm Day {currentDay.dayNumber} →
              </button>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: tokens.sp16,
                  fontFamily: tokens.fontBody,
                  fontSize: tokens.textBodySm,
                  color: tokens.ink,
                  opacity: 0.5,
                }}
              >
                ✓ Day {currentDay.dayNumber} confirmed
              </div>
            )}
          </div>

          {/* ── Right: Entry browser ──────────────────────────────────────── */}
          <div
            className="entry-browser"
            style={{
              borderTop: "1px solid rgba(26, 26, 24, 0.08)",
              paddingTop: tokens.sp32,
            }}
          >
            <h2
              style={{
                fontFamily: tokens.fontBody,
                fontWeight: 600,
                fontSize: tokens.textHeadingLg,
                lineHeight: "var(--leading-heading-lg)",
                color: tokens.ink,
                margin: `0 0 ${tokens.sp8} 0`,
              }}
            >
              Add to your trip
            </h2>

            <p
              style={{
                fontFamily: tokens.fontBody,
                fontSize: tokens.textCaption,
                color: tokens.ink,
                opacity: 0.5,
                margin: `0 0 ${tokens.sp16} 0`,
              }}
            >
              Adding to Day {selectedDay} · {TIME_BLOCK_LABEL[activeTimeBlock]}
            </p>

            {/* Time block selector */}
            <div
              style={{
                display: "flex",
                gap: tokens.sp8,
                marginBottom: tokens.sp12,
              }}
            >
              {TIME_BLOCKS.map((block) => {
                const isActive = activeTimeBlock === block;
                return (
                  <button
                    key={block}
                    type="button"
                    onClick={() => setActiveTimeBlock(block)}
                    style={{
                      fontFamily: tokens.fontBody,
                      fontSize: tokens.textOverline,
                      fontWeight: 500,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      borderRadius: tokens.radiusButton,
                      padding: "4px 10px",
                      border: isActive
                        ? `1px solid ${tokens.ink}`
                        : "1px solid rgba(26, 26, 24, 0.25)",
                      backgroundColor: isActive ? tokens.ink : "transparent",
                      color: isActive ? tokens.warm : tokens.ink,
                      WebkitAppearance: "none",
                      appearance: "none",
                      cursor: "pointer",
                      transition: "background-color 0.15s ease, color 0.15s ease",
                    }}
                  >
                    {TIME_BLOCK_LABEL[block]}
                  </button>
                );
              })}
            </div>

            {/* Category filter pills */}
            <div
              style={{
                display: "flex",
                gap: tokens.sp8,
                flexWrap: "wrap",
                marginBottom: tokens.sp16,
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
                      fontFamily: tokens.fontBody,
                      fontSize: tokens.textOverline,
                      fontWeight: 500,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      borderRadius: tokens.radiusButton,
                      padding: "4px 10px",
                      border: isActive
                        ? `1px solid ${tokens.ink}`
                        : "1px solid rgba(26, 26, 24, 0.25)",
                      backgroundColor: isActive ? tokens.ink : "transparent",
                      color: isActive ? tokens.warm : tokens.ink,
                      WebkitAppearance: "none",
                      appearance: "none",
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
                gap: tokens.sp8,
              }}
            >
              {filteredBrowserEntries.map(({ entry }) => {
                const added = addedEntryIds.has(entry.id);
                return (
                  <div
                    key={entry.id}
                    style={{
                      backgroundColor: "white",
                      borderRadius: tokens.radiusCard,
                      boxShadow: tokens.shadowCardRest,
                      padding: `${tokens.sp12} ${tokens.sp16}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: tokens.sp12,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p
                        style={{
                          fontFamily: tokens.fontBody,
                          fontWeight: 600,
                          fontSize: tokens.textBodyMd,
                          lineHeight: "var(--leading-body-md)",
                          color: tokens.ink,
                          margin: `0 0 ${tokens.sp4} 0`,
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
                          gap: tokens.sp8,
                          marginBottom: entry.editorial_hook ? tokens.sp4 : 0,
                        }}
                      >
                        {entry.neighbourhood && (
                          <span
                            style={{
                              fontFamily: tokens.fontBody,
                              fontSize: tokens.textCaption,
                              color: tokens.ink,
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
                            fontFamily: tokens.fontBody,
                            fontSize: tokens.textBodySm,
                            lineHeight: "var(--leading-body-sm)",
                            color: tokens.ink,
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
                          if (!itinerary) return;
                          const slot = itinerary.days
                            .flatMap((d) => d.slots)
                            .find((s) => s.entryId === entry.id);
                          if (slot) removeEntry(slot.id);
                        }}
                        title="Remove from itinerary"
                        style={{
                          fontFamily: tokens.fontBody,
                          fontSize: tokens.textCaption,
                          fontWeight: 500,
                          color: tokens.gold,
                          background: "none",
                          border: `1px solid ${tokens.gold}`,
                          borderRadius: tokens.radiusButton,
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
                          fontFamily: tokens.fontBody,
                          fontSize: tokens.textCaption,
                          fontWeight: 500,
                          color: tokens.ink,
                          background: "none",
                          border: "1px solid rgba(26, 26, 24, 0.35)",
                          borderRadius: tokens.radiusButton,
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
          }
        `}</style>
      </div>

      {/* ── Swap drawer — rendered at root so it escapes the inert region ── */}
      {swapTarget && (
        <SwapDrawer
          slot={swapTarget}
          alternatives={swapAlternatives}
          placedEntryIds={placedEntryIds}
          onSwap={(slotId, newEntry) => swapEntry(slotId, newEntry)}
          onRemove={(slotId) => removeEntry(slotId)}
          onClose={() => setSwapTarget(null)}
        />
      )}
    </>
  );
}
