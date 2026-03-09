"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { TripPreferences, Interest } from "@/types/preferences";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 6;

const CITY_DISPLAY: Record<string, string> = {
  krakow: "Kraków",
};

const QUESTIONS: string[] = [
  "When are you visiting?",
  "Who's travelling?",
  "What's your pace?",
  "What are you into?",
  "Where are you staying?",
  "How do you like to explore?",
];

const INTEREST_LABELS: Record<Interest, string> = {
  food_drink:            "Food & drink",
  architecture_history:  "Architecture & history",
  art_culture:           "Art & culture",
  outdoor_active:        "Outdoor & active",
  nightlife:             "Nightlife",
  hidden_gems:           "Hidden gems",
};

// ─────────────────────────────────────────────────────────────────────────────
// Tile component (stable reference — defined outside)
// ─────────────────────────────────────────────────────────────────────────────

interface TileProps {
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
}

function Tile({ label, description, selected, onClick }: TileProps) {
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
        transition:
          "border-color 0.15s ease, background-color 0.15s ease, border-width 0.15s ease",
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
      {description && (
        <span
          style={{
            display: "block",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-caption)",
            lineHeight: "var(--leading-caption)",
            color: "var(--color-warm)",
            opacity: 0.6,
            marginTop: "var(--spacing-px-4)",
          }}
        >
          {description}
        </span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  citySlug: string;
}

export default function PreferenceQuestionnaire({ citySlug }: Props) {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  // Step 0 — dates
  const [arrival, setArrival] = useState("");
  const [departure, setDeparture] = useState("");
  const [datesFlexible, setDatesFlexible] = useState(false);

  // Step 1 — group size
  const [groupSize, setGroupSize] = useState<TripPreferences["groupSize"] | null>(null);

  // Step 2 — pace
  const [pace, setPace] = useState<TripPreferences["pace"] | null>(null);

  // Step 3 — interests
  const [interests, setInterests] = useState<Interest[]>([]);

  // Step 4 — accommodation style
  const [accommodationStyle, setAccommodationStyle] = useState<
    TripPreferences["accommodationStyle"] | null
  >(null);

  // Step 5 — trip style
  const [tripStyle, setTripStyle] = useState<TripPreferences["tripStyle"] | null>(null);

  // Pending auto-advance timeout — cancelled if user navigates back
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelAutoAdvance = () => {
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
  };

  const advance = () => {
    setDirection("forward");
    setStep((s) => Math.min(6, s + 1));
  };

  const retreat = () => {
    cancelAutoAdvance();
    setDirection("back");
    setStep((s) => Math.max(0, s - 1));
  };

  const scheduleAdvance = () => {
    cancelAutoAdvance();
    autoAdvanceRef.current = setTimeout(advance, 400);
  };

  const toggleInterest = (interest: Interest) => {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest],
    );
  };

  // Auto-redirect from completion screen after 3 s
  useEffect(() => {
    if (step !== 6) return;
    const t = setTimeout(() => {
      const prefs: TripPreferences = {
        citySlug,
        arrival: arrival || null,
        departure: departure || null,
        datesFlexible,
        groupSize: groupSize!,
        pace: pace!,
        interests,
        accommodationStyle: accommodationStyle!,
        tripStyle: tripStyle!,
      };
      try {
        localStorage.setItem(
          `sonder_preferences_${citySlug}`,
          JSON.stringify(prefs),
        );
      } catch {
        // SSR / private browsing — carry on
      }
      router.push(`/${citySlug}`);
    }, 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const handleExploreNow = () => {
    cancelAutoAdvance();
    const prefs: TripPreferences = {
      citySlug,
      arrival: arrival || null,
      departure: departure || null,
      datesFlexible,
      groupSize: groupSize!,
      pace: pace!,
      interests,
      accommodationStyle: accommodationStyle!,
      tripStyle: tripStyle!,
    };
    try {
      localStorage.setItem(
        `sonder_preferences_${citySlug}`,
        JSON.stringify(prefs),
      );
    } catch {
      // SSR / private browsing
    }
    router.push(`/${citySlug}`);
  };

  const isQuestion = step < 6;
  const cityName = CITY_DISPLAY[citySlug] ?? citySlug;

  const canAdvance =
    step === 0
      ? datesFlexible || (arrival.length > 0 && departure.length > 0)
      : step === 3
        ? interests.length > 0
        : false;

  // ── Step renderers ────────────────────────────────────────────────────────

  const renderDates = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-px-16)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-px-12)" }}>
        {/* Arrival */}
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-px-8)" }}>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-caption)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--color-warm)",
              opacity: 0.5,
            }}
          >
            Arrival
          </span>
          <input
            type="date"
            value={arrival}
            onChange={(e) => {
              setArrival(e.target.value);
              setDatesFlexible(false);
            }}
            disabled={datesFlexible}
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-body-md)",
              color: datesFlexible ? "rgba(245, 240, 232, 0.30)" : "var(--color-warm)",
              backgroundColor: "transparent",
              border: "1px solid rgba(245, 240, 232, 0.20)",
              borderRadius: "var(--radius-button)",
              padding: "var(--spacing-px-12) var(--spacing-px-16)",
              outline: "none",
              width: "100%",
              colorScheme: "dark",
              cursor: datesFlexible ? "not-allowed" : "text",
            }}
          />
        </label>

        {/* Departure */}
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-px-8)" }}>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-caption)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--color-warm)",
              opacity: 0.5,
            }}
          >
            Departure
          </span>
          <input
            type="date"
            value={departure}
            min={arrival || undefined}
            onChange={(e) => {
              setDeparture(e.target.value);
              setDatesFlexible(false);
            }}
            disabled={datesFlexible}
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-body-md)",
              color: datesFlexible ? "rgba(245, 240, 232, 0.30)" : "var(--color-warm)",
              backgroundColor: "transparent",
              border: "1px solid rgba(245, 240, 232, 0.20)",
              borderRadius: "var(--radius-button)",
              padding: "var(--spacing-px-12) var(--spacing-px-16)",
              outline: "none",
              width: "100%",
              colorScheme: "dark",
              cursor: datesFlexible ? "not-allowed" : "text",
            }}
          />
        </label>
      </div>

      {/* Flexible dates link */}
      <button
        type="button"
        onClick={() => {
          setArrival("");
          setDeparture("");
          setDatesFlexible(true);
          advance();
        }}
        style={{
          background: "none",
          border: "none",
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-body-sm)",
          color: datesFlexible ? "var(--color-gold)" : "rgba(245, 240, 232, 0.50)",
          cursor: "pointer",
          padding: 0,
          textDecoration: "underline",
          textUnderlineOffset: "3px",
          alignSelf: "flex-start",
          transition: "color 0.15s ease",
        }}
      >
        I don&apos;t have dates yet
      </button>
    </div>
  );

  const renderGroupSize = () => {
    const options: Array<{ value: TripPreferences["groupSize"]; label: string }> = [
      { value: "solo",         label: "Solo" },
      { value: "couple",       label: "Couple" },
      { value: "small_group",  label: "Small group (3–4)" },
      { value: "larger_group", label: "Larger group (5+)" },
    ];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-px-12)" }}>
        {options.map(({ value, label }) => (
          <Tile
            key={value}
            label={label}
            selected={groupSize === value}
            onClick={() => {
              setGroupSize(value);
              scheduleAdvance();
            }}
          />
        ))}
      </div>
    );
  };

  const renderPace = () => {
    const options: Array<{
      value: TripPreferences["pace"];
      label: string;
      description: string;
    }> = [
      { value: "relaxed",  label: "Relaxed",  description: "A few places, explored properly" },
      { value: "balanced", label: "Balanced", description: "A solid mix — some structure, some wandering" },
      { value: "packed",   label: "Packed",   description: "See as much as possible" },
    ];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-px-12)" }}>
        {options.map(({ value, label, description }) => (
          <Tile
            key={value}
            label={label}
            description={description}
            selected={pace === value}
            onClick={() => {
              setPace(value);
              scheduleAdvance();
            }}
          />
        ))}
      </div>
    );
  };

  const renderInterests = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-px-12)" }}>
      {(Object.keys(INTEREST_LABELS) as Interest[]).map((interest) => (
        <Tile
          key={interest}
          label={INTEREST_LABELS[interest]}
          selected={interests.includes(interest)}
          onClick={() => toggleInterest(interest)}
        />
      ))}
    </div>
  );

  const renderAccommodation = () => {
    const options: Array<{
      value: TripPreferences["accommodationStyle"];
      label: string;
    }> = [
      { value: "budget",    label: "Budget" },
      { value: "mid_range", label: "Mid-range" },
      { value: "upscale",   label: "Upscale" },
      { value: "sorted",    label: "I'm already sorted" },
    ];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-px-12)" }}>
        {options.map(({ value, label }) => (
          <Tile
            key={value}
            label={label}
            selected={accommodationStyle === value}
            onClick={() => {
              setAccommodationStyle(value);
              scheduleAdvance();
            }}
          />
        ))}
      </div>
    );
  };

  const renderTripStyle = () => {
    const options: Array<{
      value: TripPreferences["tripStyle"];
      label: string;
    }> = [
      { value: "wander",  label: "Wander freely" },
      { value: "mixed",   label: "Mix of planned and spontaneous" },
      { value: "planned", label: "Fully planned" },
    ];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-px-12)" }}>
        {options.map(({ value, label }) => (
          <Tile
            key={value}
            label={label}
            selected={tripStyle === value}
            onClick={() => {
              setTripStyle(value);
              scheduleAdvance();
            }}
          />
        ))}
      </div>
    );
  };

  const renderCompletion = () => (
    <div style={{ textAlign: "center" }}>
      <h1
        className="text-display-md"
        style={{ color: "var(--color-warm)", margin: "0 0 var(--spacing-px-16) 0" }}
      >
        Your {cityName} is ready.
      </h1>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-body-md)",
          lineHeight: "var(--leading-body-md)",
          color: "var(--color-warm)",
          opacity: 0.7,
          margin: "0 0 var(--spacing-px-40) 0",
        }}
      >
        We&apos;ve shaped the guide around your trip.
      </p>
      <button
        type="button"
        onClick={handleExploreNow}
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
          transition: "opacity 0.15s ease",
        }}
      >
        Explore {cityName} →
      </button>
    </div>
  );

  const renderStepContent = () => {
    switch (step) {
      case 0: return renderDates();
      case 1: return renderGroupSize();
      case 2: return renderPace();
      case 3: return renderInterests();
      case 4: return renderAccommodation();
      case 5: return renderTripStyle();
      case 6: return renderCompletion();
      default: return null;
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "var(--color-ink)",
        overflow: "hidden",
      }}
    >
      {/* Progress bar */}
      {isQuestion && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            padding: "var(--spacing-px-24) var(--spacing-px-24) 0",
            display: "flex",
            gap: "var(--spacing-px-8)",
          }}
        >
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: "2px",
                borderRadius: "1px",
                backgroundColor:
                  i < step ? "var(--color-gold)" : "rgba(245, 240, 232, 0.15)",
                transition: "background-color 0.3s ease",
              }}
            />
          ))}
        </div>
      )}

      {/* Back button */}
      {isQuestion && step > 0 && (
        <button
          type="button"
          onClick={retreat}
          aria-label="Go back"
          style={{
            position: "absolute",
            top: "var(--spacing-px-48)",
            left: "var(--spacing-px-24)",
            zIndex: 10,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "var(--spacing-px-8)",
            color: "var(--color-warm)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M12 4L6 10L12 16"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      {/* Animated step container */}
      <div
        key={step}
        style={{
          position: "absolute",
          inset: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          animation: `${
            direction === "forward" ? "pq-slide-in-right" : "pq-slide-in-left"
          } 0.35s cubic-bezier(0.22, 1, 0.36, 1) both`,
        }}
      >
        <div
          style={{
            flex: 1,
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
            {/* Question header (not shown on completion screen) */}
            {isQuestion && (
              <>
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--text-overline)",
                    fontWeight: 500,
                    lineHeight: "var(--leading-overline)",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--color-warm)",
                    opacity: 0.5,
                    margin: "0 0 var(--spacing-px-12) 0",
                  }}
                >
                  Question {step + 1} of {TOTAL_STEPS}
                </p>
                <h1
                  className="text-display-md"
                  style={{
                    color: "var(--color-warm)",
                    margin: "0 0 var(--spacing-px-32) 0",
                  }}
                >
                  {QUESTIONS[step]}
                </h1>
              </>
            )}

            {/* Step content */}
            {renderStepContent()}

            {/* Continue button — dates (step 0) and interests (step 3) only */}
            {isQuestion && (step === 0 || step === 3) && (
              <div style={{ marginTop: "var(--spacing-px-32)" }}>
                <button
                  type="button"
                  onClick={advance}
                  disabled={!canAdvance}
                  style={{
                    fontFamily: "var(--font-body)",
                    fontWeight: 600,
                    fontSize: "var(--text-body-md)",
                    backgroundColor: canAdvance
                      ? "var(--color-gold)"
                      : "rgba(196, 154, 60, 0.25)",
                    color: canAdvance
                      ? "var(--color-ink)"
                      : "rgba(26, 26, 24, 0.40)",
                    border: "none",
                    borderRadius: "var(--radius-button)",
                    padding: "var(--spacing-px-16) var(--spacing-px-32)",
                    cursor: canAdvance ? "pointer" : "not-allowed",
                    width: "100%",
                    transition: "background-color 0.2s ease, color 0.2s ease",
                  }}
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
