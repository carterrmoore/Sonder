"use client";

import { useState } from "react";

interface DateRange {
  arrival: Date | null;
  departure: Date | null;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS = ["Mo","Tu","We","Th","Fr","Sa","Su"];

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isInRange(date: Date, start: Date, end: Date) {
  const d = date.getTime();
  return d > start.getTime() && d < end.getTime();
}

function formatDate(d: Date | null) {
  if (!d) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function nightsBetween(a: Date, b: Date) {
  return Math.round(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [noDates, setNoDates] = useState(false);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  // Build calendar grid for current view (Monday-first)
  const firstDay = new Date(viewYear, viewMonth, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(viewYear, viewMonth, d));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  function handleDayClick(day: Date) {
    if (noDates) return;
    const isPast = day < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (isPast) return;

    const { arrival, departure } = value;
    if (!arrival || (arrival && departure)) {
      onChange({ arrival: day, departure: null });
    } else {
      if (day <= arrival) {
        onChange({ arrival: day, departure: null });
      } else {
        onChange({ arrival, departure: day });
      }
    }
  }

  const { arrival, departure } = value;

  let summary = "Select your arrival date";
  if (arrival && !departure) summary = `${formatDate(arrival)} — select departure`;
  if (arrival && departure) {
    const nights = nightsBetween(arrival, departure);
    summary = `${formatDate(arrival)} – ${formatDate(departure)} (${nights} night${nights !== 1 ? "s" : ""})`;
  }
  if (noDates) summary = "Dates not set — we'll show everything";

  return (
    <div style={{ width: "100%", maxWidth: "360px", margin: "0 auto" }}>
      {/* Month navigation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--spacing-px-16)",
        }}
      >
        <button
          onClick={prevMonth}
          aria-label="Previous month"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "8px",
            color: "var(--color-warm)",
            opacity: 0.6,
            fontSize: "18px",
            lineHeight: 1,
          }}
        >
          ‹
        </button>

        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-md)",
            fontWeight: 500,
            color: "var(--color-warm)",
          }}
        >
          {MONTHS[viewMonth]} {viewYear}
        </span>

        <button
          onClick={nextMonth}
          aria-label="Next month"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "8px",
            color: "var(--color-warm)",
            opacity: 0.6,
            fontSize: "18px",
            lineHeight: 1,
          }}
        >
          ›
        </button>
      </div>

      {/* Day headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "2px",
          marginBottom: "4px",
        }}
      >
        {DAYS.map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-caption)",
              color: "var(--color-warm)",
              opacity: 0.4,
              padding: "4px 0",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "2px",
        }}
      >
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;

          const isPast =
            day < new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const isToday = isSameDay(day, today);
          const isArrival = arrival ? isSameDay(day, arrival) : false;
          const isDeparture = departure ? isSameDay(day, departure) : false;
          const inRange =
            arrival && departure ? isInRange(day, arrival, departure) : false;
          const isSelected = isArrival || isDeparture;

          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDayClick(day)}
              disabled={isPast}
              aria-label={day.toLocaleDateString()}
              style={{
                position: "relative",
                aspectRatio: "1",
                border: isToday && !isSelected
                  ? "1px solid rgba(245,240,232,0.3)"
                  : "1px solid transparent",
                borderRadius: "50%",
                cursor: isPast ? "default" : "pointer",
                backgroundColor: isSelected
                  ? "var(--color-gold)"
                  : inRange
                  ? "rgba(196,154,60,0.15)"
                  : "transparent",
                color: isSelected
                  ? "var(--color-ink)"
                  : isPast
                  ? "rgba(245,240,232,0.2)"
                  : "var(--color-warm)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-caption)",
                fontWeight: isSelected ? 600 : 400,
                transition: "background-color 120ms ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      {/* Summary line */}
      <p
        style={{
          marginTop: "var(--spacing-px-16)",
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-body-sm)",
          color: "var(--color-warm)",
          opacity: arrival ? 0.9 : 0.5,
          textAlign: "center",
        }}
      >
        {summary}
      </p>

      {/* No dates option */}
      <div style={{ textAlign: "center", marginTop: "var(--spacing-px-16)" }}>
        <button
          onClick={() => {
            setNoDates(!noDates);
            if (!noDates) onChange({ arrival: null, departure: null });
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            border: `1px solid ${noDates ? "var(--color-gold)" : "rgba(245,240,232,0.25)"}`,
            borderRadius: "var(--radius-button)",
            backgroundColor: noDates ? "rgba(196,154,60,0.12)" : "transparent",
            color: noDates ? "var(--color-gold)" : "rgba(245,240,232,0.55)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-sm)",
            cursor: "pointer",
            transition: "all 150ms ease",
          }}
        >
          {noDates ? "✓ " : ""}I don&apos;t have dates yet
        </button>
      </div>
    </div>
  );
}
