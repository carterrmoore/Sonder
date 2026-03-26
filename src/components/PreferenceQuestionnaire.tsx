"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { TripPreferences, Interest } from "@/types/preferences";
import DateRangePicker from "@/components/ui/DateRangePicker";
import ProgressBar from "@/components/questionnaire/ProgressBar";

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
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        padding: "20px var(--spacing-px-24)",
        border: "none",
        borderLeft: selected
          ? "3px solid var(--color-gold)"
          : "3px solid transparent",
        borderRadius: "0",
        backgroundColor: selected
          ? "rgba(196,154,60,0.08)"
          : "transparent",
        cursor: "pointer",
        textAlign: "left",
        transition: "background-color 150ms ease, border-left-color 150ms ease",
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.borderLeftColor = "rgba(196,154,60,0.5)";
          el.style.backgroundColor = "rgba(245,240,232,0.05)";
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.borderLeftColor = "transparent";
          el.style.backgroundColor = "transparent";
        }
      }}
    >
      <div>
        <span
          style={{
            display: "block",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-md)",
            color: "var(--color-warm)",
            opacity: selected ? 1 : 0.8,
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
              opacity: 0.5,
              marginTop: "var(--spacing-px-4)",
            }}
          >
            {description}
          </span>
        )}
      </div>

      {/* Selection indicator */}
      <span
        style={{
          width: "20px",
          height: "20px",
          borderRadius: "50%",
          border: selected
            ? "none"
            : "1.5px solid rgba(245,240,232,0.3)",
          backgroundColor: selected ? "var(--color-gold)" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "all 150ms ease",
        }}
      >
        {selected && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path
              d="M1 4L3.5 6.5L9 1"
              stroke="var(--color-ink)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  citySlug: string;
  onComplete?: (prefs: TripPreferences) => void;
}

export default function PreferenceQuestionnaire({ citySlug, onComplete }: Props) {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  // Step 0 — dates
  const [arrivalDate, setArrivalDate] = useState<Date | null>(null);
  const [departureDate, setDepartureDate] = useState<Date | null>(null);
  const [datesFlexible, setDatesFlexible] = useState(false);
  // Derived ISO strings for persistence
  const arrival = arrivalDate ? arrivalDate.toISOString().slice(0, 10) : "";
  const departure = departureDate ? departureDate.toISOString().slice(0, 10) : "";

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
    if (onComplete) {
      onComplete(prefs);
    } else {
      router.push(`/${citySlug}`);
    }
  };

  const isQuestion = step < 6;
  const cityName = CITY_DISPLAY[citySlug] ?? citySlug;

  const canAdvance =
    step === 0
      ? datesFlexible || (arrivalDate !== null && departureDate !== null)
      : step === 3
        ? interests.length > 0
        : false;

  // ── Step renderers ────────────────────────────────────────────────────────

  const renderDates = () => (
    <DateRangePicker
      value={{ arrival: arrivalDate, departure: departureDate }}
      onChange={({ arrival: a, departure: d }) => {
        setArrivalDate(a);
        setDepartureDate(d);
        if (a || d) setDatesFlexible(false);
      }}
    />
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
    <div
      style={{
        position: "relative",
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "var(--spacing-px-64) var(--spacing-px-32)",
        overflow: "hidden",
        margin: "calc(-1 * var(--spacing-px-96)) calc(-1 * var(--spacing-px-24))",
      }}
    >
      {/* Blurred background image */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url(/images/krakow-hero.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.1,
          filter: "blur(20px)",
          transform: "scale(1.05)",
        }}
        aria-hidden="true"
      />

      {/* City name */}
      <h1
        className="text-display-xl sonder-animate-fade-in-up"
        style={{
          color: "var(--color-warm)",
          margin: "0 0 var(--spacing-px-16)",
          position: "relative",
          zIndex: 1,
        }}
      >
        {cityName}
      </h1>

      <p
        className="text-body-lg sonder-animate-fade-in-up"
        style={{
          color: "var(--color-warm)",
          opacity: 0.72,
          margin: "0 0 var(--spacing-px-48)",
          maxWidth: "360px",
          position: "relative",
          zIndex: 1,
          animationDelay: "200ms",
          animationFillMode: "both",
        }}
      >
        We&apos;ve shaped the guide around your trip.
      </p>

      <button
        type="button"
        onClick={handleExploreNow}
        className="sonder-animate-fade-in"
        style={{
          padding: "14px 32px",
          backgroundColor: "var(--color-gold)",
          color: "var(--color-ink)",
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-body-sm)",
          fontWeight: 600,
          letterSpacing: "0.04em",
          border: "none",
          borderRadius: "var(--radius-button)",
          cursor: "pointer",
          position: "relative",
          zIndex: 1,
          animationDelay: "600ms",
          animationFillMode: "both",
        }}
      >
        See your {cityName}
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
      {/* Progress indicator */}
      {isQuestion && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            padding: "var(--spacing-px-24) var(--spacing-px-24) 0",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-caption)",
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-warm)",
              opacity: 0.5,
              margin: "0",
            }}
          >
            Question {step + 1} of {TOTAL_STEPS}
          </p>
          <ProgressBar current={step + 1} total={TOTAL_STEPS} />
        </div>
      )}

      {/* Exit link — always visible on question steps */}
      {isQuestion && (
        <a
          href={`/${citySlug}`}
          style={{
            position: "absolute",
            top: "var(--spacing-px-24)",
            right: "var(--spacing-px-24)",
            zIndex: 10,
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-caption)",
            color: "rgba(245, 240, 232, 0.45)",
            textDecoration: "none",
            letterSpacing: "0.04em",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 0",
          }}
        >
          Exit
        </a>
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
              maxWidth: "480px",
              paddingInline: "var(--spacing-px-24)",
            }}
          >
            {/* Question header (not shown on completion screen) */}
            {isQuestion && (
              <h1
                className="text-display-md"
                style={{
                  color: "var(--color-warm)",
                  margin: "0 0 var(--spacing-px-32) 0",
                  textAlign: step === 0 ? "center" : undefined,
                }}
              >
                {QUESTIONS[step]}
              </h1>
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
                    padding: "14px 32px",
                    backgroundColor: "var(--color-gold)",
                    color: "var(--color-ink)",
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--text-body-sm)",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    border: "none",
                    borderRadius: "var(--radius-button)",
                    cursor: canAdvance ? "pointer" : "default",
                    opacity: canAdvance ? 1 : 0.4,
                    transition: "opacity 150ms ease",
                    width: "100%",
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
