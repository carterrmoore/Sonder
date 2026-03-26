"use client";

import { useState } from "react";
import { tokens } from "@/lib/tokens";
import { Nav } from "@/components";
import type { ItineraryDay, ItinerarySlot } from "@/types/itinerary";

// ── Color constants ─────────────────────────────────────────────────────────

const BG_PRIMARY     = "#fff";
const BG_SECONDARY   = "#ece7de";
const TEXT_PRIMARY   = tokens.ink;
const TEXT_SECONDARY = "rgba(26, 26, 24, 0.65)";
const TEXT_TERTIARY  = "rgba(26, 26, 24, 0.40)";
const BORDER_TERTIARY  = "rgba(26, 26, 24, 0.08)";
const GOLD = "#C4922A";

// ── Types ───────────────────────────────────────────────────────────────────

export interface SharedItineraryViewProps {
  itinerary: {
    id: string;
    city_slug: string;
    total_days: number;
    days: ItineraryDay[];
    trip_narrative: string | null;
    finalised_at: string;
  };
  sharerName: string;
  shareToken: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const SLOT_LABEL_MAP: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  midday: "Midday",
};

function slotLabel(type: string): string {
  return SLOT_LABEL_MAP[type?.toLowerCase()] ?? type;
}

function mostFrequent(items: (string | null)[]): string {
  const counts: Record<string, number> = {};
  for (const item of items) {
    if (item) counts[item] = (counts[item] ?? 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? "";
}

function getDayNeighbourhood(day: ItineraryDay): string {
  const n = mostFrequent(day.slots.map((slot) => slot.entrySnapshot.neighbourhood));
  if (n) return n;
  const first = day.slots[0]?.entrySnapshot.neighbourhood;
  if (first) return first;
  return `Day ${day.dayNumber}`;
}

function getDayOfWeek(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

// ── Slot card ────────────────────────────────────────────────────────────────

function SlotCard({ slot }: { slot: ItinerarySlot }) {
  const [hovered, setHovered] = useState(false);
  const { name, neighbourhood, editorial_hook } = slot.entrySnapshot;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        borderRadius: "8px",
        border: `0.5px solid ${hovered ? "rgba(26,26,24,0.20)" : BORDER_TERTIARY}`,
        padding: "12px 14px",
        background: BG_PRIMARY,
        transition: "border-color 150ms ease",
      }}
    >
      <div
        style={{
          fontFamily: tokens.fontBody,
          fontSize: "13px",
          fontWeight: 500,
          color: TEXT_PRIMARY,
          marginBottom: editorial_hook ? "3px" : 0,
        }}
      >
        {name}
      </div>

      {editorial_hook && (
        <div
          style={{
            fontFamily: tokens.fontBody,
            fontSize: "12px",
            color: TEXT_SECONDARY,
            lineHeight: 1.55,
          }}
        >
          {editorial_hook}
        </div>
      )}

      {neighbourhood && (
        <div
          style={{
            fontFamily: tokens.fontBody,
            fontSize: "11px",
            color: TEXT_TERTIARY,
            textTransform: "uppercase",
            letterSpacing: "0.3px",
            marginTop: "5px",
          }}
        >
          {neighbourhood}
        </div>
      )}
    </div>
  );
}

// ── Day block ────────────────────────────────────────────────────────────────

function DayBlock({ day }: { day: ItineraryDay }) {
  const neighbourhood = getDayNeighbourhood(day);
  const dayOfWeek = getDayOfWeek(day.date);

  return (
    <div style={{ marginBottom: "32px" }}>
      <div
        style={{
          fontFamily: tokens.fontBody,
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "2px",
          color: TEXT_TERTIARY,
          marginBottom: "4px",
        }}
      >
        Day {day.dayNumber}{dayOfWeek ? ` · ${dayOfWeek}` : ""}
      </div>

      <div
        style={{
          fontFamily: tokens.fontDisplay,
          fontSize: "18px",
          letterSpacing: "-0.2px",
          color: TEXT_PRIMARY,
          fontWeight: 400,
          marginBottom: "14px",
        }}
      >
        {neighbourhood}
      </div>

      {day.slots.map((slot) => (
        <div
          key={slot.id}
          style={{
            display: "flex",
            flexDirection: "row",
            gap: "12px",
            marginBottom: "10px",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              fontFamily: tokens.fontBody,
              fontSize: "11px",
              color: TEXT_TERTIARY,
              width: "80px",
              flexShrink: 0,
              paddingTop: "12px",
            }}
          >
            {slotLabel(slot.timeBlock)}
          </div>
          <SlotCard slot={slot} />
        </div>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function SharedItineraryView({
  itinerary,
  sharerName,
  shareToken,
}: SharedItineraryViewProps) {
  const [planHover, setPlanHover] = useState(false);
  const [sidebarPlanHover, setSidebarPlanHover] = useState(false);
  const [sidebarExploreHover, setSidebarExploreHover] = useState(false);
  const [endPlanHover, setEndPlanHover] = useState(false);

  const entryCount = itinerary.days.reduce((sum, day) => sum + day.slots.length, 0);

  function scrollToFirst() {
    const el = document.getElementById("shared-day-1");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div style={{ backgroundColor: BG_PRIMARY, minHeight: "100vh" }}>
      <Nav />

      {/* Attribution banner */}
      <div
        style={{
          backgroundColor: tokens.ink,
          borderBottom: `0.5px solid rgba(255,255,255,0.08)`,
          padding: "14px 40px",
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: tokens.fontBody,
            fontSize: "13px",
            color: "rgba(255,255,255,0.6)",
          }}
        >
          <span style={{ fontWeight: 500, color: "#fff" }}>{sharerName}</span>{" "}
          shared their Krak&oacute;w itinerary with you via Sonder.
        </p>

        <div style={{ display: "flex", flexDirection: "row", gap: "10px", flexShrink: 0 }}>
          <button
            type="button"
            onClick={scrollToFirst}
            style={{
              fontFamily: tokens.fontBody,
              fontSize: "12px",
              color: "rgba(255,255,255,0.5)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 0",
            }}
          >
            See the full trip
          </button>

          <a
            href="/krakow/plan"
            onMouseEnter={() => setPlanHover(true)}
            onMouseLeave={() => setPlanHover(false)}
            style={{
              fontFamily: tokens.fontBody,
              fontSize: "12px",
              fontWeight: 500,
              padding: "8px 14px",
              borderRadius: "4px",
              backgroundColor: planHover ? "#b8831f" : GOLD,
              color: "#fff",
              textDecoration: "none",
              transition: "background-color 150ms ease",
            }}
          >
            Plan your own trip
          </a>
        </div>
      </div>

      {/* Page header */}
      <div
        style={{
          padding: "28px 40px 22px",
          borderBottom: `0.5px solid ${BORDER_TERTIARY}`,
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: tokens.fontBody,
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "2px",
              color: TEXT_TERTIARY,
              marginBottom: "8px",
            }}
          >
            Krak&oacute;w, Poland
          </div>

          <h1
            style={{
              fontFamily: tokens.fontDisplay,
              fontSize: "28px",
              letterSpacing: "-0.4px",
              color: TEXT_PRIMARY,
              fontWeight: 400,
              margin: "0 0 4px",
            }}
          >
            {sharerName}&apos;s Krak&oacute;w itinerary
          </h1>

          <div
            style={{
              fontFamily: tokens.fontBody,
              fontSize: "13px",
              color: TEXT_SECONDARY,
            }}
          >
            {itinerary.total_days} days{entryCount > 0 ? ` · ${entryCount} entries` : ""}
          </div>
        </div>
      </div>

      {/* Main two-column layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 280px",
          gap: "32px",
          alignItems: "start",
          padding: "28px 40px",
        }}
      >
        {/* Left column — days */}
        <div>
          {itinerary.days.map((day) => (
            <div key={day.dayNumber} id={`shared-day-${day.dayNumber}`}>
              <DayBlock day={day} />
            </div>
          ))}

          {/* End of itinerary CTA */}
          <div
            style={{
              borderRadius: "12px",
              border: `0.5px solid ${BORDER_TERTIARY}`,
              padding: "22px",
              marginBottom: "32px",
              backgroundColor: BG_SECONDARY,
            }}
          >
            <div
              style={{
                fontFamily: tokens.fontDisplay,
                fontSize: "18px",
                letterSpacing: "-0.2px",
                color: TEXT_PRIMARY,
                fontWeight: 400,
                marginBottom: "6px",
              }}
            >
              Want to build your own Krak&oacute;w trip?
            </div>

            <p
              style={{
                fontFamily: tokens.fontBody,
                fontSize: "13px",
                color: TEXT_SECONDARY,
                lineHeight: 1.65,
                margin: "0 0 16px",
                maxWidth: "520px",
              }}
            >
              Sonder builds you a day-by-day itinerary based on your travel style, dates,
              and what you want from the city. Every recommendation has been reviewed by
              someone who actually lives there.
            </p>

            <a
              href={`/krakow/plan?utm_source=shared_itinerary&utm_medium=referral&utm_campaign=krakow&utm_content=${shareToken}`}
              onMouseEnter={() => setEndPlanHover(true)}
              onMouseLeave={() => setEndPlanHover(false)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                fontFamily: tokens.fontBody,
                fontSize: "12px",
                fontWeight: 500,
                padding: "8px 14px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: endPlanHover ? "#b8831f" : GOLD,
                color: "#fff",
                textDecoration: "none",
                transition: "background-color 150ms ease",
              }}
            >
              Start planning
            </a>
          </div>
        </div>

        {/* Right column — sidebar */}
        <div style={{ position: "sticky", top: "20px" }}>
          {/* About Sonder card */}
          <div
            style={{
              borderRadius: "12px",
              border: `0.5px solid ${BORDER_TERTIARY}`,
              padding: "16px",
            }}
          >
            <div
              style={{
                fontFamily: tokens.fontBody,
                fontSize: "12px",
                fontWeight: 500,
                color: TEXT_PRIMARY,
                marginBottom: "8px",
              }}
            >
              About this itinerary
            </div>

            <p
              style={{
                fontFamily: tokens.fontBody,
                fontSize: "12px",
                color: TEXT_SECONDARY,
                lineHeight: 1.65,
                margin: "0 0 10px",
              }}
            >
              Built on Sonder, a curated travel platform for independent travellers.
              Every entry was reviewed by a local curator and held to a standard most
              places don&apos;t survive.
            </p>

            <p
              style={{
                fontFamily: tokens.fontBody,
                fontSize: "11px",
                color: TEXT_TERTIARY,
                margin: 0,
              }}
            >
              No paid placements. No review aggregation.
            </p>
          </div>

          {/* Plan your own trip card */}
          <div
            style={{
              borderRadius: "12px",
              border: `0.5px solid ${BORDER_TERTIARY}`,
              padding: "16px",
              marginTop: "12px",
            }}
          >
            <a
              href="/krakow/plan"
              onMouseEnter={() => setSidebarPlanHover(true)}
              onMouseLeave={() => setSidebarPlanHover(false)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                fontFamily: tokens.fontBody,
                fontSize: "12px",
                fontWeight: 500,
                padding: "8px 14px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: sidebarPlanHover ? "#b8831f" : GOLD,
                color: "#fff",
                textDecoration: "none",
                transition: "background-color 150ms ease",
                boxSizing: "border-box",
              }}
            >
              Plan your own Krak&oacute;w trip &rarr;
            </a>

            <a
              href="/krakow"
              onMouseEnter={() => setSidebarExploreHover(true)}
              onMouseLeave={() => setSidebarExploreHover(false)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                fontFamily: tokens.fontBody,
                fontSize: "12px",
                fontWeight: 500,
                padding: "8px 14px",
                borderRadius: "8px",
                border: `0.5px solid rgba(26,26,24,0.20)`,
                backgroundColor: sidebarExploreHover ? BG_SECONDARY : "transparent",
                color: sidebarExploreHover ? TEXT_PRIMARY : TEXT_SECONDARY,
                textDecoration: "none",
                transition: "background-color 150ms ease, color 150ms ease",
                boxSizing: "border-box",
                marginTop: "8px",
              }}
            >
              Explore Krak&oacute;w
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
