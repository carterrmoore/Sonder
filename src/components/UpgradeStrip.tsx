"use client";

import { useState } from "react";
import { tokens } from "@/lib/tokens";

const BG_SECONDARY     = "#ece7de";
const TEXT_PRIMARY     = tokens.ink;
const TEXT_SECONDARY   = "rgba(26, 26, 24, 0.65)";
const BORDER_TERTIARY  = "rgba(26, 26, 24, 0.08)";
const BORDER_PRIMARY   = "rgba(26, 26, 24, 0.20)";

interface UpgradeStripProps {
  onOpenModal: () => void;
}

export function UpgradeStrip({ onOpenModal }: UpgradeStripProps) {
  const [hover, setHover] = useState(false);

  return (
    <div
      style={{
        backgroundColor: BG_SECONDARY,
        borderBottom: `0.5px solid ${BORDER_TERTIARY}`,
        padding: "12px 40px",
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "20px",
      }}
    >
      <p style={{ margin: 0, fontFamily: tokens.fontBody, fontSize: "12px" }}>
        <span style={{ fontWeight: 500, color: TEXT_PRIMARY }}>
          You&apos;re viewing via a saved link.
        </span>{" "}
        <span style={{ color: TEXT_SECONDARY }}>
          Create an account for permanent access, editing, and access from any device.
        </span>
      </p>

      <button
        type="button"
        onClick={onOpenModal}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          fontFamily: tokens.fontBody,
          fontSize: "12px",
          fontWeight: 500,
          padding: "7px 14px",
          borderRadius: "8px",
          border: `0.5px solid ${BORDER_PRIMARY}`,
          background: hover ? "rgba(26, 26, 24, 0.06)" : "transparent",
          color: TEXT_PRIMARY,
          cursor: "pointer",
          whiteSpace: "nowrap",
          flexShrink: 0,
          transition: "background-color 150ms ease",
        }}
      >
        Create a free account
      </button>
    </div>
  );
}
