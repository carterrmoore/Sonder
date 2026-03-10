"use client";

import { useState, useEffect, useRef } from "react";
import CategoryPill from "@/components/ui/CategoryPill";
import type { ItinerarySlot } from "@/types/itinerary";
import type { ScoredEntry } from "@/lib/preference-filter";
import type { Category } from "@/types/pipeline";
import { buildPhotoUrl, fetchPlacePhotos } from "@/lib/maps";
import { CATEGORY_DISPLAY } from "@/pipeline/constants";
import { tokens } from "@/lib/tokens";

// ─────────────────────────────────────────────────────────────────────────────
// Contextual tag helpers
// ─────────────────────────────────────────────────────────────────────────────

function getContextualTag(
  alternative: ScoredEntry,
  originalSlot: ItinerarySlot
): string {
  const altNeighbourhood = alternative.entry.neighbourhood;
  const origNeighbourhood = originalSlot.entrySnapshot.neighbourhood;

  if (altNeighbourhood && origNeighbourhood && altNeighbourhood === origNeighbourhood) {
    return "Same neighbourhood";
  }
  if (
    (alternative.entry as any).quality_score !== undefined &&
    (originalSlot.entrySnapshot as any).quality_score !== undefined &&
    ((alternative.entry as any).quality_score ?? 0) >
      ((originalSlot.entrySnapshot as any).quality_score ?? 0) + 5
  ) {
    return "Higher rated";
  }
  if (altNeighbourhood) {
    return `Similar · ${altNeighbourhood}`;
  }
  return "Similar pick";
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface SwapDrawerProps {
  slot: ItinerarySlot;
  alternatives: ScoredEntry[];
  placedEntryIds: Set<string>;
  onSwap: (slotId: string, newEntry: ScoredEntry["entry"]) => void;
  onRemove: (slotId: string) => void;
  onClose: () => void;
}

// Internal type for alternative cards with resolved photo state
type AltPhotoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error" };

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SwapDrawer({
  slot,
  alternatives,
  placedEntryIds,
  onSwap,
  onRemove,
  onClose,
}: SwapDrawerProps) {
  // Exclude any entries placed across all days (belt-and-suspenders over the
  // pre-filtering done in ItineraryBuilder, guards against stale prop values).
  const filteredAlternatives = alternatives.filter(
    (a) => !placedEntryIds.has(a.entry.id) || a.entry.id === slot.entryId
  );
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
          backgroundColor: tokens.ink,
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
            padding: `20px ${tokens.sp24}`,
            borderBottom: "1px solid rgba(245, 240, 232, 0.10)",
          }}
        >
          <p
            style={{
              fontFamily: tokens.fontBody,
              fontWeight: 600,
              fontSize: tokens.textBodyMd,
              color: tokens.warm,
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
              color: tokens.warm,
              opacity: 0.5,
              fontSize: "22px",
              lineHeight: 1,
              padding: "4px",
              fontFamily: tokens.fontBody,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* Keep original — prominent, top position */}
          <button
            type="button"
            onClick={onClose}
            style={{
              display: "block",
              width: "100%",
              padding: `${tokens.sp16} ${tokens.sp24}`,
              backgroundColor: "transparent",
              border: "none",
              borderBottom: "1px solid rgba(26,26,24,0.1)",
              cursor: "pointer",
              textAlign: "left",
              fontFamily: tokens.fontBody,
              fontSize: tokens.textBodySm,
              fontWeight: 500,
              color: tokens.warm,
              opacity: 0.7,
            }}
          >
            Keep original
          </button>

          {/* Alternative cards */}
          {filteredAlternatives.map((alt) => {
            const altHook =
              (alt.entry as any).editorial_hook ||
              (alt.entry as any).insider_tip ||
              null;
            const tag = getContextualTag(alt, slot);

            return (
              <div
                key={alt.entry.id}
                style={{
                  display: "flex",
                  gap: "var(--spacing-px-16)",
                  padding: "var(--spacing-px-16)",
                  borderBottom: "1px solid rgba(26,26,24,0.08)",
                  alignItems: "flex-start",
                }}
              >
                {/* Photo thumbnail — 60×60 */}
                <div
                  style={{
                    width: "60px",
                    height: "60px",
                    flexShrink: 0,
                    borderRadius: 0,
                    overflow: "hidden",
                    backgroundColor: "var(--color-surface-2)",
                  }}
                >
                  <AltPhoto entry={alt} />
                </div>

                {/* Entry info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontFamily: tokens.fontBody,
                      fontSize: tokens.textBodyMd,
                      fontWeight: 600,
                      color: tokens.warm,
                      margin: "0 0 2px",
                    }}
                  >
                    {alt.entry.name}
                  </p>
                  <p
                    style={{
                      fontFamily: tokens.fontBody,
                      fontSize: tokens.textCaption,
                      color: tokens.warm,
                      opacity: 0.5,
                      margin: "0 0 4px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {alt.entry.neighbourhood
                      ? `${alt.entry.neighbourhood} · `
                      : ""}
                    {CATEGORY_DISPLAY[alt.entry.category]?.label}
                  </p>
                  {altHook && (
                    <p
                      className="line-clamp-1"
                      style={{
                        fontFamily: tokens.fontBody,
                        fontSize: tokens.textBodySm,
                        color: tokens.warm,
                        opacity: 0.65,
                        margin: "0 0 8px",
                      }}
                    >
                      {altHook}
                    </p>
                  )}
                  <span
                    style={{
                      display: "inline-block",
                      fontFamily: tokens.fontBody,
                      fontSize: tokens.textCaption,
                      color: tokens.warm,
                      opacity: 0.4,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {tag}
                  </span>
                </div>

                {/* Swap CTA */}
                <button
                  type="button"
                  onClick={() => { onSwap(slot.id, alt.entry); onClose(); }}
                  style={{
                    flexShrink: 0,
                    alignSelf: "center",
                    padding: "8px 16px",
                    backgroundColor: tokens.warm,
                    color: tokens.ink,
                    fontFamily: tokens.fontBody,
                    fontSize: tokens.textCaption,
                    fontWeight: 500,
                    border: "none",
                    borderRadius: tokens.radiusButton,
                    cursor: "pointer",
                  }}
                >
                  Swap
                </button>
              </div>
            );
          })}

          {/* Remove */}
          <button
            type="button"
            onClick={() => {
              onRemove(slot.id);
              onClose();
            }}
            style={{
              fontFamily: tokens.fontBody,
              fontSize: tokens.textBodySm,
              fontWeight: 500,
              color: "rgba(245, 240, 232, 0.40)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: `${tokens.sp16} ${tokens.sp24}`,
              textAlign: "left",
              textDecoration: "underline",
              textUnderlineOffset: "3px",
            }}
          >
            Remove from itinerary
          </button>
        </div>
      </div>

      {/* ── Responsive drawer styles ── */}
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

// ── AltPhoto ──────────────────────────────────────────────────────────────────
// 60×60 photo thumbnail for alternative cards, loads async non-blocking.

function AltPhoto({ entry: alt }: { entry: ScoredEntry }) {
  const { entry } = alt;

  const pipelineUrl: string | null =
    (entry.raw_pipeline_data as any)?.photos?.selected_url ?? null;

  const [photoState, setPhotoState] = useState<AltPhotoState>(
    pipelineUrl ? { status: "ready", url: pipelineUrl } : { status: "idle" }
  );

  useEffect(() => {
    if (pipelineUrl) return;
    if (!entry.google_place_id) return;

    let cancelled = false;
    setPhotoState({ status: "loading" });

    fetchPlacePhotos(entry.google_place_id, 1)
      .then((names) => {
        if (cancelled) return;
        if (names.length === 0) { setPhotoState({ status: "error" }); return; }
        setPhotoState({ status: "ready", url: buildPhotoUrl(names[0], 400) });
      })
      .catch(() => { if (!cancelled) setPhotoState({ status: "error" }); });

    return () => { cancelled = true; };
  }, [entry.google_place_id, pipelineUrl]);

  if (photoState.status === "ready") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoState.url}
        alt={entry.name}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        onError={() => setPhotoState({ status: "error" })}
      />
    );
  }
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "var(--color-surface-2)",
      }}
    />
  );
}
