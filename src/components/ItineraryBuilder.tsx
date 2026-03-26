"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { useItinerary } from "@/hooks/useItinerary";
import { useRouter } from "next/navigation";
import CategoryPill from "@/components/ui/CategoryPill";
import SwapDrawer from "@/components/SwapDrawer";
import ItinerarySummary from "@/components/ItinerarySummary";
import { SaveModal } from "@/components/SaveModal";
import { CATEGORY_DISPLAY, COLOR_GROUPS } from "@/pipeline/constants";
import { applyPreferences } from "@/lib/preference-filter";
import type { ScoredEntry } from "@/lib/preference-filter";
import type { EntryCardData } from "@/lib/entries";
import type { TripPreferences } from "@/types/preferences";
import type { ItineraryDay, ItinerarySlot, TimeBlock } from "@/types/itinerary";
import type { Category } from "@/types/pipeline";
import { tokens } from "@/lib/tokens";
import { buildPhotoUrl, fetchPlacePhotos } from "@/lib/maps";

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

const TIME_BLOCK_TINTS: Record<TimeBlock, string> = {
  morning:   "rgba(196, 154, 60, 0.06)",
  afternoon: "rgba(242, 160, 123, 0.06)",
  evening:   "rgba(26, 26, 24, 0.04)",
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

  const sameNeighbourhood = available.filter(
    (se) => se.entry.neighbourhood === origNeighbourhood && origNeighbourhood
  );
  const otherNeighbourhood = available.filter(
    (se) => se.entry.neighbourhood !== origNeighbourhood || !origNeighbourhood
  );

  return [...sameNeighbourhood, ...otherNeighbourhood].slice(0, 4);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface ItineraryBuilderProps {
  citySlug: string;
  entries: EntryCardData[];
  initialDays?: ItineraryDay[];
  tripLength?: number;
  isEditMode?: boolean;
  editItineraryId?: string;
}

export default function ItineraryBuilder({
  citySlug,
  entries,
  initialDays,
  tripLength,
  isEditMode = false,
  editItineraryId,
}: ItineraryBuilderProps) {
  const {
    itinerary,
    initItinerary,
    hydrateItinerary,
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
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [confirmedDays, setConfirmedDays] = useState<Set<number>>(new Set());
  const [showSummary, setShowSummary] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [modifiedDays, setModifiedDays] = useState<Set<number>>(new Set());
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`sonder_preferences_${citySlug}`);
      if (raw) setPreferences(JSON.parse(raw) as TripPreferences);
    } catch {}
  }, [citySlug]);

  useEffect(() => {
    if (!initialDays || initialDays.length === 0) return;
    if (!isEditMode) {
      const existing = localStorage.getItem(`sonder_itinerary_${citySlug}`);
      if (existing) return; // live session takes precedence in normal mode
    }
    hydrateItinerary(initialDays, tripLength ?? initialDays.length);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scoredEntries = useMemo(
    () => applyPreferences(entries, preferences),
    [entries, preferences]
  );

  const derivedTripLength = useMemo(() => {
    if (!preferences) return null;
    if (preferences.arrival && preferences.departure && !preferences.datesFlexible) {
      return nightsBetween(preferences.arrival, preferences.departure);
    }
    return null;
  }, [preferences]);

  const hasSpecificDates = !!derivedTripLength;
  const resolvedTripLength = derivedTripLength ?? selectedTripLength;

  const categories = useMemo(
    () => ["all" as const, ...Array.from(new Set(entries.map((e) => e.category)))],
    [entries]
  );

  const filteredBrowserEntries = useMemo(
    () =>
      browserCategory === "all"
        ? scoredEntries
        : scoredEntries.filter((se) => se.entry.category === browserCategory),
    [scoredEntries, browserCategory]
  );

  const addedEntryIds = useMemo(() => {
    if (!itinerary) return new Set<string>();
    return new Set(
      itinerary.days.flatMap((d) => d.slots.map((s) => s.entryId).filter(Boolean))
    );
  }, [itinerary]);

  const placedEntryIds = addedEntryIds;

  const slotCount = useMemo(
    () => (itinerary ? itinerary.days.reduce((n, d) => n + d.slots.length, 0) : 0),
    [itinerary]
  );

  const focusNeighbourhood = useMemo(() => {
    if (!itinerary) return "";
    const counts = new Map<string, number>();
    for (const day of itinerary.days) {
      for (const slot of day.slots) {
        const n =
          typeof slot.entrySnapshot.neighbourhood === "string"
            ? slot.entrySnapshot.neighbourhood
            : null;
        if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
      }
    }
    let max = 0;
    let result = "";
    for (const [n, count] of counts) {
      if (count > max) { max = count; result = n; }
    }
    return result || "Kraków";
  }, [itinerary]);

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
    setShowSaveModal(true);
  }, []);

  const handleSaveComplete = useCallback(
    (_method: "account" | "google" | "email", savedItineraryId: string) => {
      setShowSaveModal(false);
      finaliseItinerary();
      router.push(`/krakow/itinerary/${savedItineraryId}`);
    },
    [finaliseItinerary, router]
  );

  const mainRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mainRef.current) return;
    if (swapTarget) {
      mainRef.current.setAttribute("inert", "");
    } else {
      mainRef.current.removeAttribute("inert");
    }
  }, [swapTarget]);

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

  // ── Edit mode helpers ────────────────────────────────────────────────────

  function trackAndRemove(slotId: string) {
    if (isEditMode && itinerary) {
      const dayNum = itinerary.days.find((d) =>
        d.slots.some((s) => s.id === slotId)
      )?.dayNumber;
      if (dayNum !== undefined) {
        setModifiedDays((prev) => new Set([...prev, dayNum]));
      }
    }
    removeEntry(slotId);
  }

  function trackAndSwap(slotId: string, newEntry: EntryCardData) {
    if (isEditMode && itinerary) {
      const dayNum = itinerary.days.find((d) =>
        d.slots.some((s) => s.id === slotId)
      )?.dayNumber;
      if (dayNum !== undefined) {
        setModifiedDays((prev) => new Set([...prev, dayNum]));
      }
    }
    swapEntry(slotId, newEntry);
  }

  async function handleEditDone() {
    if (!itinerary || !editItineraryId) return;
    setIsSavingEdit(true);
    // TODO: Run Gate 0 check on net-new entries before saving.
    // Net-new = entries in current days that weren't in the original editItinerary.days.
    // Deferred to post-launch -- add to outstanding tasks.
    try {
      const res = await fetch(`/api/itineraries/${editItineraryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days: itinerary.days,
          total_days: itinerary.tripLength,
        }),
      });
      if (res.ok) {
        router.push(`/krakow/itinerary/${editItineraryId}`);
      }
    } finally {
      setIsSavingEdit(false);
    }
  }

  // ── State A — setup ──────────────────────────────────────────────────────
  if (!itinerary && !isEditMode) {
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

  // ── Edit mode loading (hydrating from database) ──────────────────────────
  if (!itinerary) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: tokens.ink,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p
          style={{
            fontFamily: tokens.fontBody,
            fontSize: tokens.textBodySm,
            color: tokens.warm,
            opacity: 0.45,
          }}
        >
          Loading your itinerary...
        </p>
      </div>
    );
  }

  // ── State C — summary screen (with save modal overlay) ───────────────────
  if (showSummary && !isEditMode) {
    const CITY_NAMES: Record<string, string> = { krakow: "Kraków" };
    return (
      <>
        <ItinerarySummary
          itinerary={itinerary}
          totalEntryCount={entries.length}
          onSave={handleSave}
          onBackToEdit={handleBackToEdit}
        />
        <SaveModal
          isOpen={showSaveModal}
          itineraryId={itinerary.id}
          itinerary={itinerary}
          itinerarySummary={{
            cityName:           CITY_NAMES[citySlug] ?? citySlug,
            tripLength:         itinerary.tripLength,
            entryCount:         slotCount,
            focusNeighbourhood,
            startDate:          preferences?.arrival ?? null,
            endDate:            preferences?.departure ?? null,
          }}
          onSaveComplete={handleSaveComplete}
        />
      </>
    );
  }

  // ── State B — builder ────────────────────────────────────────────────────
  const currentDay =
    itinerary.days.find((d) => d.dayNumber === selectedDay) ?? itinerary.days[0];

  return (
    <>
      <div
        ref={mainRef}
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflow: "hidden",
          backgroundColor: "var(--color-warm)",
        }}
      >
        {/* ── Edit mode header ────────────────────────────────────────────── */}
        {isEditMode && (
          <div
            style={{
              backgroundColor: tokens.ink,
              padding: "14px 24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: tokens.fontBody,
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "1.5px",
                  color: "rgba(255,255,255,0.35)",
                  marginBottom: "2px",
                }}
              >
                Editing your trip
              </div>
              <div
                style={{
                  fontFamily: tokens.fontDisplay,
                  fontSize: "18px",
                  color: "#fff",
                  fontWeight: 400,
                }}
              >
                Kraków &middot; {itinerary.tripLength} day
                {itinerary.tripLength !== 1 ? "s" : ""} confirmed
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                type="button"
                onClick={() =>
                  router.push(`/krakow/itinerary/${editItineraryId}`)
                }
                style={{
                  fontFamily: tokens.fontBody,
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.5)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0",
                }}
              >
                Back to itinerary
              </button>
              <button
                type="button"
                onClick={handleEditDone}
                disabled={isSavingEdit}
                style={{
                  fontFamily: tokens.fontBody,
                  fontSize: "12px",
                  fontWeight: 500,
                  backgroundColor: isSavingEdit
                    ? "rgba(196, 146, 42, 0.6)"
                    : "#C4922A",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 14px",
                  cursor: isSavingEdit ? "not-allowed" : "pointer",
                }}
              >
                {isSavingEdit ? "Saving..." : "Done"}
              </button>
            </div>
          </div>
        )}

        {/* ── Full-width tab bar ──────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
            borderBottom: "1px solid rgba(26,26,24,0.1)",
            backgroundColor: "var(--color-warm)",
            flexShrink: 0,
            padding: "0 var(--spacing-px-24)",
          }}
        >
          {/* Back link — hidden in edit mode */}
          {!isEditMode && (
            <a
              href={`/${citySlug}`}
              style={{
                fontFamily: tokens.fontBody,
                fontSize: tokens.textCaption,
                color: tokens.ink,
                opacity: 0.45,
                textDecoration: "none",
                marginRight: "var(--spacing-px-24)",
                whiteSpace: "nowrap",
                padding: "14px 0",
              }}
            >
              ← Kraków guide
            </a>
          )}

          {/* Day tabs */}
          <div style={{ display: "flex", alignItems: "stretch", gap: 0, flex: 1 }}>
            {itinerary.days.map((day) => {
              const isActive = selectedDay === day.dayNumber;
              const isConfirmed = confirmedDays.has(day.dayNumber);
              const isModified = modifiedDays.has(day.dayNumber);
              return (
                <button
                  key={day.dayNumber}
                  type="button"
                  onClick={() => setSelectedDay(day.dayNumber)}
                  style={{
                    position: "relative",
                    padding: "0 var(--spacing-px-24)",
                    height: "48px",
                    border: "none",
                    borderRight: "1px solid rgba(26,26,24,0.08)",
                    backgroundColor: isActive
                      ? "var(--color-warm)"
                      : "rgba(26,26,24,0.02)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontFamily: tokens.fontBody,
                    fontSize: tokens.textBodySm,
                    fontWeight: isActive ? 600 : 400,
                    color: tokens.ink,
                    opacity: isActive ? 1 : 0.5,
                    transition: "opacity 150ms ease, background-color 150ms ease",
                    borderBottom: isActive
                      ? "2px solid var(--color-ink)"
                      : "2px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive)
                      (e.currentTarget as HTMLButtonElement).style.opacity = "0.8";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive)
                      (e.currentTarget as HTMLButtonElement).style.opacity = "0.5";
                  }}
                >
                  {isEditMode ? (
                    isModified ? (
                      <span
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          backgroundColor: "#C4922A",
                          display: "inline-block",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <svg
                        width="10"
                        height="8"
                        viewBox="0 0 10 8"
                        fill="none"
                        style={{ color: "#2d9e5a", opacity: 0.7 }}
                      >
                        <path
                          d="M1 4L3.5 6.5L9 1"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )
                  ) : (
                    isConfirmed && (
                      <svg
                        width="10"
                        height="8"
                        viewBox="0 0 10 8"
                        fill="none"
                        style={{ opacity: 0.5 }}
                      >
                        <path
                          d="M1 4L3.5 6.5L9 1"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )
                  )}
                  Day {day.dayNumber}
                </button>
              );
            })}
          </div>

          {/* Trip label — hidden in edit mode (shown in edit header instead) */}
          {!isEditMode && (
            <span
              style={{
                fontFamily: tokens.fontBody,
                fontSize: tokens.textCaption,
                color: tokens.ink,
                opacity: 0.35,
                marginLeft: "var(--spacing-px-24)",
                whiteSpace: "nowrap",
              }}
            >
              {itinerary.days.length} day{itinerary.days.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* ── Two-column body ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── Left sidebar ────────────────────────────────────────────────── */}
        <aside
          style={{
            width: "380px",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid rgba(26,26,24,0.08)",
            backgroundColor: "var(--color-warm)",
            overflow: "hidden",
          }}
        >

          {/* Sidebar scrollable body: time block selectors */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "var(--spacing-px-16) 0",
            }}
          >
            {TIME_BLOCKS.map((block) => {
              const isActive = activeTimeBlock === block;
              const slotsForBlock = currentDay.slots.filter(
                (s) => s.timeBlock === block
              );

              return (
                <div key={block} style={{ marginBottom: "2px" }}>
                  {/* Time block selector button */}
                  <button
                    type="button"
                    onClick={() => setActiveTimeBlock(block)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      padding: "10px var(--spacing-px-24)",
                      border: "none",
                      backgroundColor: isActive
                        ? TIME_BLOCK_TINTS[block]
                        : "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      borderLeft: isActive
                        ? "3px solid var(--color-gold)"
                        : "3px solid transparent",
                      transition: "all 150ms ease",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: tokens.fontBody,
                        fontSize: tokens.textOverline,
                        fontWeight: isActive ? 600 : 500,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: tokens.ink,
                        opacity: isActive ? 1 : 0.4,
                      }}
                    >
                      {TIME_BLOCK_LABEL[block]}
                    </span>

                    {!isActive && slotsForBlock.length > 0 && (
                      <span
                        style={{
                          fontFamily: tokens.fontBody,
                          fontSize: tokens.textCaption,
                          color: tokens.ink,
                          opacity: 0.35,
                        }}
                      >
                        {slotsForBlock.length}
                      </span>
                    )}
                  </button>

                  {/* Expanded slot list when active */}
                  {isActive && (
                    <div
                      style={{
                        backgroundColor: TIME_BLOCK_TINTS[block],
                        padding: "0 var(--spacing-px-24) var(--spacing-px-12)",
                      }}
                    >
                      {slotsForBlock.length === 0 ? (
                        <p
                          style={{
                            fontFamily: tokens.fontBody,
                            fontSize: tokens.textBodySm,
                            color: tokens.ink,
                            opacity: 0.35,
                            margin: "var(--spacing-px-8) 0",
                            fontStyle: "italic",
                          }}
                        >
                          Nothing added yet
                        </p>
                      ) : (
                        slotsForBlock.map((slot) => {
                          const slotHook =
                            (slot.entrySnapshot as any).editorial_hook ||
                            (slot.entrySnapshot as any).insider_tip ||
                            null;
                          const neighbourhood = slot.entrySnapshot.neighbourhood;

                          return (
                            <div
                              key={slot.id}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                justifyContent: "space-between",
                                gap: "var(--spacing-px-8)",
                                padding: "var(--spacing-px-12) 0",
                                borderBottom: "1px solid rgba(26,26,24,0.06)",
                                animation:
                                  justAdded === slot.entryId
                                    ? "sonder-fade-in-up 200ms ease forwards"
                                    : "none",
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p
                                  style={{
                                    fontFamily: tokens.fontBody,
                                    fontSize: tokens.textBodySm,
                                    fontWeight: 600,
                                    color: tokens.ink,
                                    margin: "0 0 2px",
                                  }}
                                >
                                  {slot.entrySnapshot.name}
                                </p>
                                <p
                                  style={{
                                    fontFamily: tokens.fontBody,
                                    fontSize: tokens.textCaption,
                                    color: tokens.ink,
                                    opacity: 0.5,
                                    margin: "0 0 4px",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                  }}
                                >
                                  {neighbourhood ? `${neighbourhood} · ` : ""}
                                  {CATEGORY_DISPLAY[slot.entrySnapshot.category as Category]?.label}
                                </p>
                                {slotHook && (
                                  <p
                                    style={{
                                      fontFamily: tokens.fontBody,
                                      fontSize: tokens.textCaption,
                                      color: tokens.ink,
                                      opacity: 0.5,
                                      margin: 0,
                                      display: "-webkit-box",
                                      WebkitLineClamp: 1,
                                      WebkitBoxOrient: "vertical",
                                      overflow: "hidden",
                                    }}
                                  >
                                    {slotHook}
                                  </p>
                                )}
                              </div>

                              <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                                <button
                                  type="button"
                                  onClick={() => setSwapTarget(slot)}
                                  aria-label={`Swap ${slot.entrySnapshot.name}`}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: tokens.ink,
                                    opacity: 0.4,
                                    padding: "4px",
                                    display: "flex",
                                    alignItems: "center",
                                  }}
                                >
                                  <ArrowLeftRight size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => trackAndRemove(slot.id)}
                                  aria-label={`Remove ${slot.entrySnapshot.name}`}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: tokens.ink,
                                    opacity: 0.4,
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
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sidebar footer: confirm day */}
          <div
            style={{
              padding: "var(--spacing-px-16) var(--spacing-px-24)",
              borderTop: "1px solid rgba(26,26,24,0.08)",
              flexShrink: 0,
            }}
          >
            {isEditMode ? null : !confirmedDays.has(currentDay.dayNumber) ? (
              <button
                type="button"
                onClick={() => handleConfirmDay(currentDay.dayNumber)}
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: tokens.ink,
                  color: tokens.warm,
                  fontFamily: tokens.fontBody,
                  fontSize: tokens.textBodySm,
                  fontWeight: 600,
                  border: "none",
                  borderRadius: "var(--radius-button)",
                  cursor: "pointer",
                  letterSpacing: "0.02em",
                }}
              >
                Confirm Day {currentDay.dayNumber} →
              </button>
            ) : (
              <div
                style={{
                  textAlign: "center",
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
        </aside>

        {/* ── Right panel ─────────────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            backgroundColor: TIME_BLOCK_TINTS[activeTimeBlock],
            transition: "background-color 300ms ease",
          }}
        >
          {/* Right panel header */}
          <div
            style={{
              padding: "var(--spacing-px-16) var(--spacing-px-32)",
              borderBottom: "1px solid rgba(26,26,24,0.08)",
              flexShrink: 0,
            }}
          >
            <p
              style={{
                fontFamily: tokens.fontBody,
                fontSize: tokens.textOverline,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: tokens.ink,
                opacity: 0.5,
                margin: "0 0 var(--spacing-px-12)",
              }}
            >
              {TIME_BLOCK_LABEL[activeTimeBlock]} — Day {selectedDay}
            </p>

            {/* Category filter pills */}
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {categories.map((cat) => {
                const isActive = browserCategory === cat;
                const label = cat === "all" ? "All" : CATEGORY_DISPLAY[cat].label;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setBrowserCategory(cat)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: "var(--radius-button)",
                      border: isActive
                        ? "none"
                        : "1px solid rgba(26,26,24,0.15)",
                      backgroundColor: isActive ? tokens.ink : "transparent",
                      color: isActive ? tokens.warm : tokens.ink,
                      fontFamily: tokens.fontBody,
                      fontSize: tokens.textCaption,
                      fontWeight: isActive ? 500 : 400,
                      opacity: isActive ? 1 : 0.55,
                      cursor: "pointer",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      transition: "all 120ms ease",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable card grid */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "var(--spacing-px-32)",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "20px",
                alignItems: "start",
              }}
            >
              {filteredBrowserEntries.map(({ entry }) => {
                const isAdded = addedEntryIds.has(entry.id);
                const hook =
                  entry.editorial_hook ||
                  (entry as any).insider_tip ||
                  null;
                const neighbourhoodName =
                  typeof entry.neighbourhood === "string"
                    ? entry.neighbourhood
                    : Array.isArray(entry.neighbourhood)
                    ? (entry.neighbourhood[0] as any)?.display_name ?? null
                    : (entry.neighbourhood as any)?.display_name ?? null;

                return (
                  <div
                    key={entry.id}
                    style={{
                      backgroundColor: "var(--color-card)",
                      borderRadius: "var(--radius-card)",
                      boxShadow: isAdded ? "none" : "var(--shadow-card-rest)",
                      overflow: "hidden",
                      opacity: isAdded ? 0.55 : 1,
                      transition: "opacity 200ms ease, box-shadow 200ms ease",
                    }}
                  >
                    <Link
                      href={`/krakow/${entry.slug}`}
                      style={{ textDecoration: "none", display: "block", color: "inherit" }}
                    >
                      <EntryCardPhoto entry={entry} />

                      <div style={{ padding: "14px 16px 8px" }}>
                        {neighbourhoodName && (
                          <p
                            style={{
                              fontFamily: tokens.fontBody,
                              fontSize: tokens.textCaption,
                              color: tokens.ink,
                              opacity: 0.45,
                              margin: "0 0 3px",
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                            }}
                          >
                            {neighbourhoodName}
                          </p>
                        )}

                        <p
                          style={{
                            fontFamily: tokens.fontBody,
                            fontSize: tokens.textBodySm,
                            fontWeight: 600,
                            color: tokens.ink,
                            margin: "0 0 6px",
                            lineHeight: 1.3,
                          }}
                        >
                          {entry.name}
                        </p>

                        {hook && (
                          <p
                            style={{
                              fontFamily: tokens.fontBody,
                              fontSize: tokens.textCaption,
                              color: tokens.ink,
                              opacity: 0.6,
                              margin: 0,
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              lineHeight: 1.45,
                            }}
                          >
                            {hook}
                          </p>
                        )}
                      </div>
                    </Link>

                    <div style={{ padding: "8px 16px 14px" }}>
                      {isAdded ? (
                        <button
                          type="button"
                          onClick={() => {
                            const slot = itinerary.days
                              .flatMap((d) => d.slots)
                              .find((s) => s.entryId === entry.id);
                            if (slot) trackAndRemove(slot.id);
                          }}
                          style={{
                            width: "100%",
                            padding: "8px",
                            backgroundColor: "transparent",
                            color: tokens.gold,
                            border: `1px solid ${tokens.gold}`,
                            borderRadius: "var(--radius-button)",
                            fontFamily: tokens.fontBody,
                            fontSize: tokens.textCaption,
                            fontWeight: 500,
                            cursor: "pointer",
                            transition: "all 150ms ease",
                            letterSpacing: "0.02em",
                          }}
                        >
                          ✓ Added
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setJustAdded(entry.id);
                            addEntry(entry, selectedDay, activeTimeBlock);
                            if (isEditMode) setModifiedDays((prev) => new Set([...prev, selectedDay]));
                            setTimeout(() => setJustAdded(null), 400);
                          }}
                          style={{
                            width: "100%",
                            padding: "8px",
                            backgroundColor: tokens.ink,
                            color: tokens.warm,
                            border: "none",
                            borderRadius: "var(--radius-button)",
                            fontFamily: tokens.fontBody,
                            fontSize: tokens.textCaption,
                            fontWeight: 500,
                            cursor: "pointer",
                            transition: "all 150ms ease",
                            letterSpacing: "0.02em",
                          }}
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        </div>{/* end two-column body */}
      </div>

      {/* Swap drawer — outside inert region */}
      {swapTarget && (
        <SwapDrawer
          slot={swapTarget}
          alternatives={swapAlternatives}
          placedEntryIds={placedEntryIds}
          onSwap={(slotId, newEntry) => trackAndSwap(slotId, newEntry)}
          onRemove={(slotId) => trackAndRemove(slotId)}
          onClose={() => setSwapTarget(null)}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EntryCardPhoto — photo loader for browser cards
// ─────────────────────────────────────────────────────────────────────────────

function EntryCardPhoto({ entry }: { entry: EntryCardData }) {
  const display = CATEGORY_DISPLAY[entry.category];
  const fallbackBg = COLOR_GROUPS[display?.colorGroup]?.bg ?? "var(--color-surface-3)";

  const pipelineUrl: string | null =
    (entry.raw_pipeline_data as any)?.photos?.selected_url ?? null;

  const [photoUrl, setPhotoUrl] = useState<string | null>(pipelineUrl);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (pipelineUrl || !entry.google_place_id) return;
    let cancelled = false;
    fetchPlacePhotos(entry.google_place_id, 1)
      .then((names) => {
        if (cancelled || names.length === 0) return;
        setPhotoUrl(buildPhotoUrl(names[0], 600));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [entry.google_place_id, pipelineUrl]);

  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "3 / 2",
        backgroundColor: error || !photoUrl ? fallbackBg : "#e8e2d9",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {photoUrl && !error && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={entry.name}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: 0,
          }}
          onError={() => setError(true)}
        />
      )}
      <div style={{ position: "absolute", top: 10, left: 10, zIndex: 1 }}>
        <CategoryPill category={entry.category} size="sm" />
      </div>
    </div>
  );
}
