"use client";

import { useEffect, useRef } from "react";
import CategoryPill from "@/components/ui/CategoryPill";
import type { ItinerarySlot } from "@/types/itinerary";
import type { ScoredEntry } from "@/lib/preference-filter";
import type { Category } from "@/types/pipeline";

// ─────────────────────────────────────────────────────────────────────────────
// Contextual swap tag logic
// ─────────────────────────────────────────────────────────────────────────────

function swapTag(
  original: ItinerarySlot,
  alternative: ScoredEntry
): string {
  const altNeighbourhood = alternative.entry.neighbourhood;
  const origNeighbourhood = original.entrySnapshot.neighbourhood;
  const altCategory = alternative.entry.category;
  const origCategory = original.entrySnapshot.category;
  const altPrice = alternative.entry.price_level;
  const origPrice = original.entrySnapshot as { price_level?: number | null };

  // 1. Same neighbourhood
  if (altNeighbourhood && origNeighbourhood && altNeighbourhood === origNeighbourhood) {
    return `Also in ${altNeighbourhood}`;
  }
  // 2. Different neighbourhood, same category
  if (altCategory === origCategory) {
    return "Similar spot, different area";
  }
  // 3. Higher score than a baseline (we use 65 as "highly rated")
  if (alternative.score >= 65) {
    return "Highly rated alternative";
  }
  // 4. Similar price level
  const origPriceLevel = (origPrice as { price_level?: number | null }).price_level ?? null;
  if (altPrice !== null && origPriceLevel !== null && Math.abs(altPrice - origPriceLevel) <= 1) {
    return "Similar price point";
  }
  return "Alternative pick";
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface SwapDrawerProps {
  slot: ItinerarySlot;
  alternatives: ScoredEntry[];
  onSwap: (slotId: string, newEntry: ScoredEntry["entry"]) => void;
  onRemove: (slotId: string) => void;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SwapDrawer({
  slot,
  alternatives,
  onSwap,
  onRemove,
  onClose,
}: SwapDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus the close button on open
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Trap focus inside drawer
  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    function onFocusOut(e: FocusEvent) {
      if (!drawer!.contains(e.relatedTarget as Node | null)) {
        closeRef.current?.focus();
      }
    }
    drawer.addEventListener("focusout", onFocusOut);
    return () => drawer.removeEventListener("focusout", onFocusOut);
  }, []);

  return (
    <>
      {/* ── Scrim ────────────────────────────────────────────────────────── */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(26, 26, 24, 0.5)",
          zIndex: 40,
        }}
      />

      {/* ── Drawer panel ─────────────────────────────────────────────────── */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Swap ${slot.entrySnapshot.name}`}
        style={{
          position: "fixed",
          zIndex: 50,
          backgroundColor: "var(--color-ink)",
          overflowY: "auto",
        }}
        className="swap-drawer"
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--spacing-px-20) var(--spacing-px-24)",
            borderBottom: "1px solid rgba(245, 240, 232, 0.10)",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              fontSize: "var(--text-body-md)",
              color: "var(--color-warm)",
              margin: 0,
            }}
          >
            Swap{" "}
            <span style={{ opacity: 0.6, fontWeight: 400 }}>
              {slot.entrySnapshot.name}
            </span>
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close swap drawer"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--color-warm)",
              opacity: 0.5,
              fontSize: "22px",
              lineHeight: 1,
              padding: "4px",
              fontFamily: "var(--font-body)",
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: "var(--spacing-px-20) var(--spacing-px-24)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-px-12)",
          }}
        >
          {/* Keep original */}
          <button
            type="button"
            onClick={onClose}
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              fontSize: "var(--text-body-sm)",
              color: "var(--color-warm)",
              background: "none",
              border: "1px solid rgba(245, 240, 232, 0.20)",
              borderRadius: "var(--radius-button)",
              padding: "var(--spacing-px-12) var(--spacing-px-16)",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            Keep original
          </button>

          {/* Divider */}
          <div
            style={{
              height: "1px",
              backgroundColor: "rgba(245, 240, 232, 0.08)",
              marginBlock: "var(--spacing-px-4)",
            }}
          />

          {/* Alternative cards */}
          {alternatives.map((alt) => {
            const tag = swapTag(slot, alt);
            return (
              <div
                key={alt.entry.id}
                style={{
                  backgroundColor: "rgba(245, 240, 232, 0.05)",
                  border: "1px solid rgba(245, 240, 232, 0.10)",
                  borderRadius: "var(--radius-card)",
                  padding: "var(--spacing-px-16)",
                }}
              >
                {/* Name */}
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontWeight: 600,
                    fontSize: "var(--text-body-md)",
                    lineHeight: "var(--leading-body-md)",
                    color: "var(--color-warm)",
                    margin: "0 0 var(--spacing-px-4) 0",
                  }}
                >
                  {alt.entry.name}
                </p>

                {/* Neighbourhood + pill */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--spacing-px-8)",
                    marginBottom: "var(--spacing-px-8)",
                    flexWrap: "wrap",
                  }}
                >
                  {alt.entry.neighbourhood && (
                    <span
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "var(--text-caption)",
                        color: "var(--color-warm)",
                        opacity: 0.5,
                      }}
                    >
                      {alt.entry.neighbourhood}
                    </span>
                  )}
                  <CategoryPill
                    category={alt.entry.category as Category}
                    size="sm"
                  />
                </div>

                {/* Hook */}
                {alt.entry.editorial_hook && (
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--text-body-sm)",
                      lineHeight: "var(--leading-body-sm)",
                      color: "var(--color-warm)",
                      opacity: 0.6,
                      margin: "0 0 var(--spacing-px-12) 0",
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 1,
                      overflow: "hidden",
                    }}
                  >
                    {alt.entry.editorial_hook}
                  </p>
                )}

                {/* Tag + action row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--spacing-px-8)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--text-caption)",
                      color: "var(--color-warm)",
                      opacity: 0.45,
                      fontStyle: "italic",
                    }}
                  >
                    {tag}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onSwap(slot.id, alt.entry);
                      onClose();
                    }}
                    style={{
                      fontFamily: "var(--font-body)",
                      fontWeight: 600,
                      fontSize: "var(--text-caption)",
                      backgroundColor: "var(--color-gold)",
                      color: "var(--color-ink)",
                      border: "none",
                      borderRadius: "var(--radius-button)",
                      padding: "6px 14px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    Swap →
                  </button>
                </div>
              </div>
            );
          })}

          {/* Divider */}
          <div
            style={{
              height: "1px",
              backgroundColor: "rgba(245, 240, 232, 0.08)",
              marginBlock: "var(--spacing-px-4)",
            }}
          />

          {/* Remove */}
          <button
            type="button"
            onClick={() => {
              onRemove(slot.id);
              onClose();
            }}
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-body-sm)",
              fontWeight: 500,
              color: "rgba(245, 240, 232, 0.40)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "var(--spacing-px-8) 0",
              textAlign: "left",
              textDecoration: "underline",
              textUnderlineOffset: "3px",
            }}
          >
            Remove from itinerary
          </button>
        </div>
      </div>

      {/* ── Responsive drawer styles ──────────────────────────────────────── */}
      <style>{`
        .swap-drawer {
          bottom: 0;
          left: 0;
          right: 0;
          max-height: 85vh;
          border-radius: 16px 16px 0 0;
          animation: sheet-up 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes sheet-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @media (min-width: 900px) {
          .swap-drawer {
            top: 0;
            right: 0;
            bottom: 0;
            left: auto;
            width: 400px;
            max-height: 100vh;
            border-radius: 0;
            animation: drawer-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
          }
          @keyframes drawer-in {
            from { transform: translateX(100%); }
            to   { transform: translateX(0); }
          }
        }
      `}</style>
    </>
  );
}
