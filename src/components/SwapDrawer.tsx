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

        <div
          style={{
            padding: `20px ${tokens.sp24}`,
            display: "flex",
            flexDirection: "column",
            gap: tokens.sp12,
          }}
        >
          {/* Keep original */}
          <button
            type="button"
            onClick={onClose}
            style={{
              fontFamily: tokens.fontBody,
              fontWeight: 500,
              fontSize: tokens.textBodySm,
              color: tokens.warm,
              background: "none",
              border: "1px solid rgba(245, 240, 232, 0.20)",
              borderRadius: tokens.radiusButton,
              padding: `${tokens.sp12} ${tokens.sp16}`,
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
              marginBlock: tokens.sp4,
            }}
          />

          {/* Alternative cards */}
          {filteredAlternatives.map((alt) => (
            <AlternativeCard
              key={alt.entry.id}
              alt={alt}
              onSwap={() => { onSwap(slot.id, alt.entry); onClose(); }}
            />
          ))}

          {/* Divider */}
          <div
            style={{
              height: "1px",
              backgroundColor: "rgba(245, 240, 232, 0.08)",
              marginBlock: tokens.sp4,
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
              fontFamily: tokens.fontBody,
              fontSize: tokens.textBodySm,
              fontWeight: 500,
              color: "rgba(245, 240, 232, 0.40)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: `${tokens.sp8} 0`,
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

// ── AlternativeCard ───────────────────────────────────────────────────────────
// Thumbnail (64×64) + name + meta. Photo loads async, non-blocking.

interface AlternativeCardProps {
  alt: ScoredEntry;
  onSwap: (entryId: string) => void;
}

function AlternativeCard({ alt, onSwap }: AlternativeCardProps) {
  const { entry } = alt;

  const pipelineUrl: string | null =
    (entry.raw_pipeline_data as any)?.photos?.selected_url ?? null;

  const [photoState, setPhotoState] = useState<AltPhotoState>(
    pipelineUrl ? { status: "ready", url: pipelineUrl } : { status: "idle" }
  );

  useEffect(() => {
    if (pipelineUrl) return; // already resolved
    if (!entry.google_place_id) return; // no fallback possible

    let cancelled = false;
    setPhotoState({ status: "loading" });

    fetchPlacePhotos(entry.google_place_id, 1)
      .then((names) => {
        if (cancelled) return;
        if (names.length === 0) {
          setPhotoState({ status: "error" });
          return;
        }
        setPhotoState({ status: "ready", url: buildPhotoUrl(names[0], 800) });
      })
      .catch(() => {
        if (!cancelled) setPhotoState({ status: "error" });
      });

    return () => { cancelled = true; };
  }, [entry.google_place_id, pipelineUrl]);

  const display = CATEGORY_DISPLAY[entry.category];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: tokens.sp12,
        padding: `${tokens.sp12} ${tokens.sp16}`,
        cursor: "pointer",
        borderBottom: `1px solid color-mix(in srgb, ${tokens.ink} 8%, transparent)`,
      }}
      onClick={() => onSwap(entry.id)}
    >
      {/* 64×64 thumbnail */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 4,
          overflow: "hidden",
          flexShrink: 0,
          backgroundColor: tokens.card,
        }}
      >
        {photoState.status === "ready" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoState.url}
            alt={entry.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={() => setPhotoState({ status: "error" })}
          />
        )}
        {/* idle / loading / error → empty colored block, no fallback stub */}
        {(photoState.status === "idle" || photoState.status === "loading") && (
          <div style={{ width: "100%", height: "100%", backgroundColor: tokens.card }} />
        )}
      </div>

      {/* Name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: tokens.fontDisplay,
            fontSize: tokens.textBodyMd,
            fontWeight: 400,
            color: tokens.ink,
            margin: "0 0 2px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {entry.name}
        </p>
        <p
          style={{
            fontFamily: tokens.fontBody,
            fontSize: tokens.textCaption,
            color: tokens.ink,
            opacity: 0.55,
            margin: 0,
          }}
        >
          {display.label}{entry.neighbourhood ? ` · ${entry.neighbourhood}` : ""}
        </p>
      </div>

      {/* Swap CTA */}
      <button
        style={{
          fontFamily: tokens.fontBody,
          fontSize: tokens.textCaption,
          fontWeight: 500,
          color: tokens.ink,
          background: "none",
          border: `1px solid color-mix(in srgb, ${tokens.ink} 25%, transparent)`,
          borderRadius: tokens.radiusButton,
          padding: "4px 10px",
          cursor: "pointer",
          flexShrink: 0,
        }}
        onClick={(e) => { e.stopPropagation(); onSwap(entry.id); }}
      >
        Swap
      </button>
    </div>
  );
}
