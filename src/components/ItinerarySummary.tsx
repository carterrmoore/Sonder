"use client";

import CategoryPill from "@/components/ui/CategoryPill";
import type { Itinerary } from "@/types/itinerary";
import type { Category } from "@/types/pipeline";

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
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: 600,
                  fontSize: "var(--text-heading-lg)",
                  lineHeight: "var(--leading-heading-lg)",
                  color: "var(--color-warm)",
                  margin: "0 0 var(--spacing-px-20) 0",
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
                  {day.slots.map((slot) => (
                    <div
                      key={slot.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "var(--spacing-px-16)",
                        paddingBottom: "var(--spacing-px-12)",
                        borderBottom: "1px solid rgba(245, 240, 232, 0.08)",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p
                          style={{
                            fontFamily: "var(--font-body)",
                            fontWeight: 600,
                            fontSize: "var(--text-body-md)",
                            lineHeight: "var(--leading-body-md)",
                            color: "var(--color-warm)",
                            margin: 0,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {slot.entrySnapshot.name}
                        </p>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--spacing-px-8)",
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-body)",
                            fontSize: "var(--text-caption)",
                            color: "var(--color-warm)",
                            opacity: 0.4,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {TIME_BLOCK_LABEL[slot.timeBlock] ?? slot.timeBlock}
                        </span>
                        <CategoryPill
                          category={slot.entrySnapshot.category as Category}
                          size="sm"
                        />
                      </div>
                    </div>
                  ))}
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
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-md)",
            lineHeight: "var(--leading-body-md)",
            color: "var(--color-warm)",
            opacity: 0.6,
            margin: "0 0 var(--spacing-px-32) 0",
          }}
        >
          {totalEntryCount} places. {totalSlots} in your itinerary. No tourist traps.
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
