"use client";

import { useState, useRef, useCallback } from "react";
import { tokens } from "@/lib/tokens";

// ── Types ──────────────────────────────────────────────────────────────────────

export type MapMode = "zones" | "pins";

export interface MapZone {
  id: string;
  label: string;
  description: string;
}

export interface MapPin {
  id: string;
  number: number;
  label: string;
  detail: string;
  neighbourhood: string;
  isPrimary: boolean;
}

interface MapPanelProps {
  mode: MapMode;
  height?: number;
  headerLabel: string;
  zones?: MapZone[];
  pins?: MapPin[];
  citySlug: string;
}

// ── Design constants ───────────────────────────────────────────────────────────

const GOLD_ACTIVE  = "#C4922A";
const BG_PRIMARY   = tokens.warm;           // #f5f0e8
const BG_SECONDARY = "#ece7de";
const TEXT_PRIMARY = tokens.ink;            // #1a1a18
const TEXT_SECONDARY = "rgba(26, 26, 24, 0.58)";
const TEXT_TERTIARY  = "rgba(26, 26, 24, 0.42)";
const BORDER_TERTIARY  = "rgba(26, 26, 24, 0.08)";
const BORDER_SECONDARY = "rgba(26, 26, 24, 0.12)";
const BORDER_PRIMARY   = "rgba(26, 26, 24, 0.20)";

// ── Main component ─────────────────────────────────────────────────────────────

export function MapPanel({
  mode,
  height = 480,
  headerLabel,
  zones = [],
  pins = [],
  citySlug,
}: MapPanelProps) {
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [activePinId,  setActivePinId]  = useState<string | null>(null);

  const pinRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const registerPinRow = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      pinRowRefs.current.set(id, el);
    } else {
      pinRowRefs.current.delete(id);
    }
  }, []);

  const handlePinEnter = useCallback((id: string) => {
    setActivePinId(id);
    const el = pinRowRefs.current.get(id);
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, []);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        height,
        borderRadius: tokens.radiusModal,
        border: `0.5px solid ${BORDER_TERTIARY}`,
        overflow: "hidden",
      }}
    >
      {/* Left column -- scrollable list */}
      <div
        className="map-panel-list"
        style={{
          height,
          overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: `${BORDER_SECONDARY} transparent`,
        }}
      >
        <style>{`
          .map-panel-list::-webkit-scrollbar { width: 3px; }
          .map-panel-list::-webkit-scrollbar-track { background: transparent; }
          .map-panel-list::-webkit-scrollbar-thumb {
            background: ${BORDER_SECONDARY};
            border-radius: 2px;
          }
        `}</style>

        {/* Sticky header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 1,
            padding: "16px 20px",
            borderBottom: `0.5px solid ${BORDER_TERTIARY}`,
            backgroundColor: BG_PRIMARY,
            fontFamily: tokens.fontBody,
            fontSize: "12px",
            fontWeight: 500,
            color: TEXT_SECONDARY,
          }}
        >
          {headerLabel}
        </div>

        {/* List rows */}
        {mode === "zones" && (
          <ZoneList
            zones={zones}
            activeZoneId={activeZoneId}
            onEnter={setActiveZoneId}
            onLeave={() => setActiveZoneId(null)}
          />
        )}

        {mode === "pins" && (
          <PinList
            pins={pins}
            activePinId={activePinId}
            onEnter={handlePinEnter}
            registerRef={registerPinRow}
          />
        )}
      </div>

      {/* Right column -- map */}
      <div
        style={{
          height,
          overflow: "hidden",
          backgroundColor: "#e8e4db",
        }}
      >
        <div id={`map-container-${citySlug}`} style={{ width: "100%", height: "100%" }}>
          {mode === "zones" && (
            <>
              {/* TODO: Replace with Google Maps instance targeting #map-container-{citySlug} */}
              <KrakowZoneMap activeZoneId={activeZoneId} />
            </>
          )}
          {mode === "pins" && (
            <>
              {/* TODO: Replace with Google Maps instance targeting #map-container-{citySlug} */}
              <KrakowPinMap pins={pins} activePinId={activePinId} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Zone list ──────────────────────────────────────────────────────────────────

interface ZoneListProps {
  zones: MapZone[];
  activeZoneId: string | null;
  onEnter: (id: string) => void;
  onLeave: () => void;
}

function ZoneList({ zones, activeZoneId, onEnter, onLeave }: ZoneListProps) {
  return (
    <>
      {zones.map((zone, i) => {
        const isActive = zone.id === activeZoneId;
        const isLast = i === zones.length - 1;
        return (
          <div
            key={zone.id}
            onMouseEnter={() => onEnter(zone.id)}
            onMouseLeave={onLeave}
            style={{
              padding: "18px 20px",
              borderBottom: isLast ? "none" : `0.5px solid ${isActive ? BORDER_PRIMARY : BORDER_TERTIARY}`,
              backgroundColor: isActive ? BG_SECONDARY : "transparent",
              cursor: "default",
              transition: "background-color 150ms ease",
            }}
          >
            <div
              style={{
                fontFamily: tokens.fontDisplay,
                fontSize: "16px",
                fontWeight: 400,
                color: isActive ? GOLD_ACTIVE : TEXT_PRIMARY,
                marginBottom: "6px",
                letterSpacing: "-0.1px",
                transition: "color 150ms ease",
              }}
            >
              {zone.label}
            </div>
            <div
              style={{
                fontFamily: tokens.fontBody,
                fontSize: "12px",
                color: TEXT_SECONDARY,
                lineHeight: 1.65,
              }}
            >
              {zone.description}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ── Pin list ───────────────────────────────────────────────────────────────────

interface PinListProps {
  pins: MapPin[];
  activePinId: string | null;
  onEnter: (id: string) => void;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
}

function PinList({ pins, activePinId, onEnter, registerRef }: PinListProps) {
  return (
    <>
      {pins.map((pin, i) => {
        const isActive = pin.id === activePinId;
        const isLast = i === pins.length - 1;
        return (
          <div
            key={pin.id}
            ref={(el) => registerRef(pin.id, el)}
            onMouseEnter={() => onEnter(pin.id)}
            style={{
              padding: "14px 20px",
              borderBottom: isLast ? "none" : `0.5px solid ${BORDER_TERTIARY}`,
              backgroundColor: isActive ? BG_SECONDARY : "transparent",
              cursor: "pointer",
              transition: "background-color 150ms ease",
              display: "flex",
              flexDirection: "row",
              alignItems: "flex-start",
              gap: "10px",
            }}
          >
            {/* Number badge */}
            <div
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10px",
                fontWeight: 500,
                fontFamily: tokens.fontBody,
                ...(pin.isPrimary
                  ? { backgroundColor: GOLD_ACTIVE, color: "#fff" }
                  : {
                      backgroundColor: BG_SECONDARY,
                      color: TEXT_SECONDARY,
                      border: `0.5px solid ${BORDER_SECONDARY}`,
                    }),
              }}
            >
              {pin.number}
            </div>

            {/* Text content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: tokens.fontBody,
                  fontSize: "13px",
                  fontWeight: 500,
                  color: TEXT_PRIMARY,
                  marginBottom: "4px",
                }}
              >
                {pin.label}
              </div>
              <div
                style={{
                  fontFamily: tokens.fontBody,
                  fontSize: "12px",
                  color: TEXT_SECONDARY,
                  lineHeight: 1.5,
                }}
              >
                {pin.detail}
              </div>
              <div
                style={{
                  fontFamily: tokens.fontBody,
                  fontSize: "11px",
                  color: TEXT_TERTIARY,
                  textTransform: "uppercase",
                  letterSpacing: "0.3px",
                  marginTop: "3px",
                }}
              >
                {pin.neighbourhood}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ── SVG zone map (Krakow schematic) ───────────────────────────────────────────

const ZONE_PATHS: Record<string, { d: string; cx: number; cy: number; label: string }> = {
  "stare-miasto": {
    d: "M110,120 L225,118 L228,215 L175,222 L140,218 L108,210 Z",
    cx: 168, cy: 165,
    label: "Stare Miasto",
  },
  "kazimierz": {
    d: "M175,222 L228,215 L240,285 L220,292 L175,288 L162,270 Z",
    cx: 203, cy: 254,
    label: "Kazimierz",
  },
  "podgorze": {
    d: "M120,310 L260,308 L268,395 L195,402 L118,392 Z",
    cx: 193, cy: 355,
    label: "Podgorze",
  },
  "kleparz": {
    d: "M88,42 L200,40 L210,122 L108,120 L84,115 Z",
    cx: 148, cy: 82,
    label: "Kleparz",
  },
  "zwierzyniec": {
    d: "M30,130 L110,120 L108,210 L100,285 L38,270 L28,200 Z",
    cx: 70, cy: 200,
    label: "Zwierzyniec",
  },
  "nowa-huta": {
    d: "M228,100 L318,98 L322,258 L238,260 L228,215 Z",
    cx: 275, cy: 178,
    label: "Nowa Huta",
  },
};

// Wisla river approximate path through Krakow
const WISLA_PATH =
  "M 18,292 C 60,288 100,296 145,295 C 180,294 215,298 248,300 C 278,302 306,296 328,290";

interface KrakowZoneMapProps {
  activeZoneId: string | null;
}

function KrakowZoneMap({ activeZoneId }: KrakowZoneMapProps) {
  return (
    <svg
      viewBox="0 0 340 480"
      preserveAspectRatio="xMidYMid slice"
      width="100%"
      height="100%"
      style={{ display: "block" }}
    >
      {/* City background */}
      <rect x="0" y="0" width="340" height="480" fill="#ddd8cf" />

      {/* Zone polygons */}
      {Object.entries(ZONE_PATHS).map(([id, zone]) => (
        <path
          key={id}
          d={zone.d}
          fill={activeZoneId === id ? GOLD_ACTIVE : "#cac4ba"}
          stroke="#e8e4db"
          strokeWidth="1.5"
          style={{ transition: "fill 150ms ease" }}
        />
      ))}

      {/* Wisla river */}
      <path
        d={WISLA_PATH}
        fill="none"
        stroke="#b8d4e8"
        strokeWidth="8"
        strokeLinecap="round"
      />

      {/* Zone labels */}
      {Object.entries(ZONE_PATHS).map(([id, zone]) => (
        <text
          key={id}
          x={zone.cx}
          y={zone.cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily={tokens.fontBody}
          fontSize="9"
          fill={activeZoneId === id ? "#fff" : "#6b6660"}
          style={{ pointerEvents: "none", transition: "fill 150ms ease" }}
        >
          {zone.label}
        </text>
      ))}
    </svg>
  );
}

// ── SVG pin map (Krakow schematic) ────────────────────────────────────────────

// Approximate pin positions within the 340x480 viewBox
// Kazimierz pins clustered around x:175-325, y:235-280
// Stare Miasto pins around x:140-195, y:155-180
const PIN_POSITIONS: Record<number, { x: number; y: number }> = {
  1:  { x: 175, y: 258 },
  2:  { x: 205, y: 244 },
  3:  { x: 240, y: 262 },
  4:  { x: 268, y: 250 },
  5:  { x: 300, y: 268 },
  6:  { x: 320, y: 242 },
  7:  { x: 145, y: 162 },
  8:  { x: 168, y: 155 },
  9:  { x: 190, y: 175 },
  10: { x: 155, y: 178 },
};

// Light zone overlays for context
const STARE_MIASTO_LIGHT = "M110,130 L225,128 L228,215 L140,218 L108,210 Z";
const KAZIMIERZ_LIGHT    = "M168,222 L238,218 L245,290 L162,285 Z";
const WISLA_PATH_PINS    =
  "M 18,300 C 60,296 100,304 145,303 C 180,302 215,306 248,308 C 278,310 306,304 328,298";

interface KrakowPinMapProps {
  pins: MapPin[];
  activePinId: string | null;
}

function KrakowPinMap({ pins, activePinId }: KrakowPinMapProps) {
  return (
    <svg
      viewBox="0 0 340 480"
      preserveAspectRatio="xMidYMid slice"
      width="100%"
      height="100%"
      style={{ display: "block" }}
    >
      {/* Background */}
      <rect x="0" y="0" width="340" height="480" fill="#ddd8cf" />

      {/* Light neighbourhood overlays for context */}
      <path d={STARE_MIASTO_LIGHT} fill="#cac4ba" stroke="#e8e4db" strokeWidth="1" />
      <path d={KAZIMIERZ_LIGHT}    fill="#cac4ba" stroke="#e8e4db" strokeWidth="1" />

      {/* Wisla river */}
      <path
        d={WISLA_PATH_PINS}
        fill="none"
        stroke="#b8d4e8"
        strokeWidth="8"
        strokeLinecap="round"
      />

      {/* Neighbourhood labels */}
      <text x="168" y="172" textAnchor="middle" fontFamily={tokens.fontBody} fontSize="8" fill="#888780">
        Stare Miasto
      </text>
      <text x="205" y="300" textAnchor="middle" fontFamily={tokens.fontBody} fontSize="8" fill="#888780">
        Kazimierz
      </text>

      {/* Pin circles -- render inactive first, then active on top */}
      {pins.map((pin) => {
        const pos = PIN_POSITIONS[pin.number] ?? { x: 170, y: 240 };
        const isActive = pin.id === activePinId;
        const r = isActive ? 13 : 11;
        const fill = isActive
          ? "#a07520"
          : pin.isPrimary
          ? GOLD_ACTIVE
          : "#888780";

        return (
          <g key={pin.id} style={{ transition: "all 150ms ease" }}>
            <circle cx={pos.x} cy={pos.y} r={r} fill={fill} />
            <text
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily={tokens.fontBody}
              fontSize="9"
              fontWeight="500"
              fill="#fff"
              style={{ pointerEvents: "none" }}
            >
              {pin.number}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
