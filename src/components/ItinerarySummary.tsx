"use client";

import type { Itinerary } from "@/types/itinerary";
import type { Category } from "@/types/pipeline";
import { CATEGORY_DISPLAY } from "@/pipeline/constants";

const TIME_BLOCK_LABEL: Record<string, string> = {
  morning:   "Morning",
  afternoon: "Afternoon",
  evening:   "Evening",
};

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

interface ItinerarySummaryProps {
  itinerary: Itinerary;
  totalEntryCount: number;
  onSave: () => void;
  onBackToEdit: () => void;
}

export default function ItinerarySummary({
  itinerary,
  totalEntryCount,
  onSave,
  onBackToEdit,
}: ItinerarySummaryProps) {
  const totalSlots = itinerary.days.reduce((n, d) => n + d.slots.length, 0);

  // Date range from days
  const firstDate = itinerary.days[0]?.date ?? null;
  const lastDate = itinerary.days[itinerary.days.length - 1]?.date ?? null;

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--color-ink)",
        overflowX: "hidden",
      }}
    >
      {/* ── Atmospheric header ─────────────────────────────────────────────── */}
      <div
        style={{
          paddingTop: "var(--spacing-px-80)",
          paddingBottom: "var(--spacing-px-48)",
          paddingInline: "var(--spacing-px-24)",
          maxWidth: "680px",
          margin: "0 auto",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-overline)",
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-gold)",
            margin: "0 0 var(--spacing-px-16) 0",
          }}
        >
          Kraków
        </p>

        <h1
          className="text-display-lg"
          style={{
            color: "var(--color-warm)",
            margin: "0 0 var(--spacing-px-12) 0",
          }}
        >
          Your {itinerary.tripLength}-day itinerary.
        </h1>

        {firstDate && lastDate && firstDate !== lastDate && (
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-body-md)",
              lineHeight: "var(--leading-body-md)",
              color: "var(--color-warm)",
              opacity: 0.5,
              margin: 0,
            }}
          >
            {formatDate(firstDate)} – {formatDate(lastDate)}
          </p>
        )}
      </div>

      {/* ── Day cards ──────────────────────────────────────────────────────── */}
      <div
        style={{
          maxWidth: "680px",
          margin: "0 auto",
          paddingInline: "var(--spacing-px-24)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-px-48)",
          paddingBottom: "var(--spacing-px-64)",
        }}
      >
        {itinerary.days.map((day) => {
          const headingNeighbourhood =
            day.slots[0]?.entrySnapshot.neighbourhood ?? null;

          return (
            <div key={day.dayNumber}>
              {/* Day overline */}
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-overline)",
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--color-warm)",
                  opacity: 0.4,
                  margin: "0 0 var(--spacing-px-8) 0",
                }}
              >
                Day {day.dayNumber}
                {day.date && (
                  <span style={{ fontWeight: 400 }}>
                    {" "}
                    ·{" "}
                    {new Date(day.date + "T00:00:00").toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                )}
              </p>

              {/* Neighbourhood heading */}
              <h2
                className="text-display-md"
                style={{
                  color: "var(--color-warm)",
                  margin: "0 0 var(--spacing-px-24) 0",
                }}
              >
                {headingNeighbourhood ?? `Day ${day.dayNumber}`}
              </h2>

              {/* Slot list */}
              {day.slots.length === 0 ? (
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--text-body-sm)",
                    color: "var(--color-warm)",
                    opacity: 0.3,
                    margin: 0,
                  }}
                >
                  No places added
                </p>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--spacing-px-12)",
                  }}
                >
                  {day.slots.map((slot) => {
                    const slotHook =
                      (slot.entrySnapshot as any).editorial_hook ||
                      (slot.entrySnapshot as any).insider_tip ||
                      (slot.entrySnapshot as any).why_it_made_the_cut ||
                      null;
                    return (
                    <div
                      key={slot.id}
                      style={{
                        paddingBottom: "var(--spacing-px-16)",
                        borderBottom: "1px solid rgba(245, 240, 232, 0.08)",
                      }}
                    >
                      {/* Time block + category */}
                      <p style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "var(--text-caption)",
                        color: "var(--color-warm)",
                        opacity: 0.5,
                        margin: "0 0 2px",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}>
                        {TIME_BLOCK_LABEL[slot.timeBlock] ?? slot.timeBlock}
                        {" · "}
                        {CATEGORY_DISPLAY[slot.entrySnapshot.category as Category]?.label}
                      </p>

                      {/* Venue name */}
                      <p style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "var(--text-body-md)",
                        fontWeight: 600,
                        color: "var(--color-warm)",
                        margin: "0 0 4px",
                      }}>
                        {slot.entrySnapshot.name}
                      </p>

                      {/* Editorial hook — italic */}
                      {slotHook && (
                        <p style={{
                          fontFamily: "var(--font-body)",
                          fontSize: "var(--text-body-sm)",
                          fontStyle: "italic",
                          color: "var(--color-warm)",
                          opacity: 0.6,
                          margin: 0,
                          lineHeight: "var(--leading-body-sm)",
                        }}>
                          {slotHook}
                        </p>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── CTA block ──────────────────────────────────────────────────────── */}
      <div
        style={{
          borderTop: "1px solid rgba(245, 240, 232, 0.08)",
          padding: "var(--spacing-px-48) var(--spacing-px-24)",
          maxWidth: "680px",
          margin: "0 auto",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            fontSize: "var(--text-heading-lg)",
            lineHeight: "var(--leading-heading-lg)",
            color: "var(--color-warm)",
            margin: "0 0 var(--spacing-px-8) 0",
          }}
        >
          You&apos;re ready.
        </h2>
        <p
          className="text-body-lg"
          style={{
            color: "var(--color-warm)",
            opacity: 0.7,
            margin: "0 0 var(--spacing-px-32) 0",
          }}
        >
          {totalSlots} places, chosen for you. No tourist traps, no paid placements.
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-px-12)",
          }}
        >
          <button
            type="button"
            onClick={onSave}
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              fontSize: "var(--text-body-md)",
              backgroundColor: "var(--color-gold)",
              color: "var(--color-ink)",
              border: "none",
              borderRadius: "var(--radius-button)",
              padding: "var(--spacing-px-16) var(--spacing-px-32)",
              cursor: "pointer",
              width: "100%",
              transition: "opacity 0.15s ease",
            }}
          >
            Save itinerary
          </button>

          <button
            type="button"
            onClick={onBackToEdit}
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              fontSize: "var(--text-body-md)",
              backgroundColor: "transparent",
              color: "var(--color-warm)",
              border: "1px solid rgba(245, 240, 232, 0.25)",
              borderRadius: "var(--radius-button)",
              padding: "var(--spacing-px-16) var(--spacing-px-32)",
              cursor: "pointer",
              width: "100%",
              transition: "border-color 0.15s ease",
            }}
          >
            Back to edit
          </button>
        </div>
      </div>
    </div>
  );
}
