"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { tokens } from "@/lib/tokens";
import type { Itinerary } from "@/types/itinerary";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SaveModalProps {
  isOpen: boolean;
  itineraryId: string;
  itinerary: Itinerary;
  itinerarySummary: {
    cityName: string;
    tripLength: number;
    entryCount: number;
    focusNeighbourhood: string;
    startDate: string | null;
    endDate: string | null;
  };
  onSaveComplete: (method: "account" | "google" | "email", savedItineraryId: string) => void;
}

// ── Design constants ───────────────────────────────────────────────────────────

const BG_PRIMARY   = "#fff";
const BG_SECONDARY = "#ece7de";
const TEXT_PRIMARY   = tokens.ink;
const TEXT_SECONDARY = "rgba(26, 26, 24, 0.65)";
const TEXT_TERTIARY  = "rgba(26, 26, 24, 0.40)";
const BORDER_SECONDARY = "rgba(26, 26, 24, 0.12)";
const BORDER_TERTIARY  = "rgba(26, 26, 24, 0.08)";
const DANGER = "#c0392b";
const GOLD   = "#C4922A";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const sMonth = s.toLocaleDateString("en-US", { month: "short" });
  const eMonth = e.toLocaleDateString("en-US", { month: "short" });
  const sDay   = s.getDate();
  const eDay   = e.getDate();
  if (sMonth === eMonth) return `${sMonth} ${sDay} - ${eDay}`;
  return `${sMonth} ${sDay} - ${eMonth} ${eDay}`;
}

function mapAccountError(message: string): string {
  if (message.includes("User already registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  return message;
}

// ── Arrow icon ─────────────────────────────────────────────────────────────────

function ArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

// ── Google "G" icon ────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function SaveModal({
  isOpen,
  itineraryId,
  itinerary,
  itinerarySummary,
  onSaveComplete,
}: SaveModalProps) {
  const supabase = createClient();

  // Account creation state
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [accountError, setAccountError] = useState<string | null>(null);
  const [isAccountLoading, setIsAccountLoading] = useState(false);

  // Google SSO state
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleHover, setGoogleHover] = useState(false);

  // Email-only state
  const [emailOnly,      setEmailOnly]      = useState("");
  const [emailOnlyError, setEmailOnlyError] = useState<string | null>(null);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [emailBtnHover,  setEmailBtnHover]  = useState(false);

  if (!isOpen) return null;

  // ── Persist itinerary to database ────────────────────────────────────────

  async function persistItinerary(userId: string | null): Promise<{ ok: boolean; itineraryId?: string }> {
    try {
      const res = await fetch("/api/save-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          citySlug:      itinerary.citySlug,
          tripLength:    itinerary.tripLength,
          days:          itinerary.days,
          anchorBlocks:  null,
          entryMeta:     null,
          tripNarrative: null,
        }),
      });
      if (!res.ok) return { ok: false };
      const json = await res.json() as { ok: boolean; itineraryId: string };
      return { ok: true, itineraryId: json.itineraryId };
    } catch {
      return { ok: false };
    }
  }

  // ── Account creation ─────────────────────────────────────────────────────

  async function handleAccountSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAccountError(null);
    setIsAccountLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setIsAccountLoading(false);
      setAccountError(mapAccountError(error.message));
      return;
    }
    const saved = await persistItinerary(data.user?.id ?? null);
    if (!saved.ok || !saved.itineraryId) {
      setIsAccountLoading(false);
      setAccountError("Something went wrong saving your trip. Please try again.");
      return;
    }
    setIsAccountLoading(false);
    onSaveComplete("account", saved.itineraryId);
  }

  // ── Google SSO ────────────────────────────────────────────────────────────

  async function handleGoogle() {
    setIsGoogleLoading(true);
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/krakow/itinerary/${itineraryId}`
        : `/krakow/itinerary/${itineraryId}`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    // Page will redirect to Google -- loading state stays true
  }

  // ── Email-only ────────────────────────────────────────────────────────────

  async function handleEmailOnly(e: React.FormEvent) {
    e.preventDefault();
    setEmailOnlyError(null);
    setIsEmailLoading(true);

    // Step 1 — save the itinerary first so we have a real DB id
    const saved = await persistItinerary(null);
    if (!saved.ok || !saved.itineraryId) {
      setEmailOnlyError("Something went wrong saving your trip. Please try again.");
      setIsEmailLoading(false);
      return;
    }

    // Step 2 — create the email capture record against the saved itinerary
    try {
      const captureRes = await fetch("/api/email-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email:           emailOnly,
          itineraryId:     saved.itineraryId,
          citySlug:        "krakow",
          cityDisplayName: "Kraków",
          cityId:          "21b778e8-0b37-4adc-ae10-5a226929c59c",
        }),
      });
      if (!captureRes.ok) {
        const data = await captureRes.json().catch(() => ({}));
        setEmailOnlyError((data as { error?: string }).error ?? "Something went wrong.");
        setIsEmailLoading(false);
        return;
      }
    } catch {
      setEmailOnlyError("Could not connect. Please try again.");
      setIsEmailLoading(false);
      return;
    }

    onSaveComplete("email", saved.itineraryId);
  }

  // ── Derived display values ────────────────────────────────────────────────

  const { cityName, tripLength, entryCount, focusNeighbourhood, startDate, endDate } =
    itinerarySummary;

  const datePill =
    startDate && endDate ? formatDateRange(startDate, endDate) : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          backgroundColor: BG_PRIMARY,
          borderRadius: tokens.radiusModal,
          border: `0.5px solid ${BORDER_TERTIARY}`,
          maxWidth: "420px",
          width: "100%",
          padding: "36px",
        }}
      >
        {/* Eyebrow */}
        <p
          style={{
            fontFamily: tokens.fontBody,
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "2px",
            color: TEXT_TERTIARY,
            marginBottom: "12px",
            marginTop: 0,
          }}
        >
          One last thing
        </p>

        {/* Headline */}
        <h2
          style={{
            fontFamily: tokens.fontDisplay,
            fontSize: "24px",
            letterSpacing: "-0.3px",
            lineHeight: 1.2,
            color: TEXT_PRIMARY,
            fontWeight: 400,
            marginBottom: "8px",
            marginTop: 0,
          }}
        >
          Save your itinerary to see the full trip.
        </h2>

        {/* Subtext */}
        <p
          style={{
            fontFamily: tokens.fontBody,
            fontSize: "13px",
            color: TEXT_SECONDARY,
            lineHeight: 1.65,
            marginBottom: "22px",
            marginTop: 0,
          }}
        >
          Create a free account for permanent access from any device, or just
          enter your email for a save link. Either way, your trip is waiting on
          the other side.
        </p>

        {/* Trip preview strip */}
        <div
          style={{
            backgroundColor: BG_SECONDARY,
            borderRadius: tokens.radiusCard,
            padding: "14px 16px",
            marginBottom: "24px",
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: tokens.fontBody,
                fontSize: "13px",
                fontWeight: 500,
                color: TEXT_PRIMARY,
                marginBottom: "3px",
              }}
            >
              {cityName}
            </div>
            <div
              style={{
                fontFamily: tokens.fontBody,
                fontSize: "12px",
                color: TEXT_SECONDARY,
              }}
            >
              {tripLength} days &middot; {entryCount} entries &middot; {focusNeighbourhood} focus
            </div>
          </div>

          {datePill && (
            <div
              style={{
                fontFamily: tokens.fontBody,
                fontSize: "11px",
                color: TEXT_TERTIARY,
                backgroundColor: "#fff",
                border: `0.5px solid ${BORDER_TERTIARY}`,
                borderRadius: "20px",
                padding: "3px 10px",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {datePill}
            </div>
          )}
        </div>

        {/* Account creation form */}
        <form onSubmit={handleAccountSubmit}>
          {/* Email field */}
          <div style={{ marginBottom: "10px" }}>
            <label
              style={{
                display: "block",
                fontFamily: tokens.fontBody,
                fontSize: "12px",
                color: TEXT_SECONDARY,
                marginBottom: "5px",
              }}
            >
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="save-modal-input"
              style={{
                width: "100%",
                padding: "10px 14px",
                fontSize: "14px",
                fontFamily: tokens.fontBody,
                borderRadius: "8px",
                border: `0.5px solid ${BORDER_SECONDARY}`,
                backgroundColor: BG_PRIMARY,
                color: TEXT_PRIMARY,
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Password field */}
          <div style={{ marginBottom: "10px" }}>
            <label
              style={{
                display: "block",
                fontFamily: tokens.fontBody,
                fontSize: "12px",
                color: TEXT_SECONDARY,
                marginBottom: "5px",
              }}
            >
              Password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="save-modal-input"
              style={{
                width: "100%",
                padding: "10px 14px",
                fontSize: "14px",
                fontFamily: tokens.fontBody,
                borderRadius: "8px",
                border: `0.5px solid ${BORDER_SECONDARY}`,
                backgroundColor: BG_PRIMARY,
                color: TEXT_PRIMARY,
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Primary CTA */}
          <button
            type="submit"
            disabled={isAccountLoading}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              width: "100%",
              marginTop: "6px",
              backgroundColor: isAccountLoading ? "rgba(196, 146, 42, 0.6)" : GOLD,
              color: "#fff",
              fontSize: "14px",
              fontWeight: 500,
              fontFamily: tokens.fontBody,
              padding: "12px 20px",
              borderRadius: "8px",
              border: "none",
              cursor: isAccountLoading ? "not-allowed" : "pointer",
            }}
          >
            {isAccountLoading ? "Creating account..." : "Create account and see my trip"}
            {!isAccountLoading && <ArrowIcon />}
          </button>

          {/* Account error */}
          {accountError && (
            <p
              style={{
                fontFamily: tokens.fontBody,
                fontSize: "12px",
                color: DANGER,
                marginTop: "8px",
                marginBottom: 0,
              }}
            >
              {accountError}
            </p>
          )}
        </form>

        {/* Divider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            margin: "14px 0",
          }}
        >
          <div style={{ flex: 1, height: "0.5px", backgroundColor: BORDER_TERTIARY }} />
          <span
            style={{
              fontFamily: tokens.fontBody,
              fontSize: "12px",
              color: TEXT_TERTIARY,
            }}
          >
            or
          </span>
          <div style={{ flex: 1, height: "0.5px", backgroundColor: BORDER_TERTIARY }} />
        </div>

        {/* Google SSO button */}
        <button
          type="button"
          disabled={isGoogleLoading}
          onClick={handleGoogle}
          onMouseEnter={() => setGoogleHover(true)}
          onMouseLeave={() => setGoogleHover(false)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            width: "100%",
            backgroundColor: googleHover && !isGoogleLoading ? BG_SECONDARY : BG_PRIMARY,
            border: `0.5px solid ${BORDER_SECONDARY}`,
            borderRadius: "8px",
            padding: "11px 20px",
            fontSize: "14px",
            fontWeight: 500,
            fontFamily: tokens.fontBody,
            color: TEXT_PRIMARY,
            cursor: isGoogleLoading ? "not-allowed" : "pointer",
            transition: "background-color 150ms ease",
          }}
        >
          <GoogleIcon />
          {isGoogleLoading ? "Redirecting..." : "Continue with Google"}
        </button>

        {/* Email-only section */}
        <div
          style={{
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: `0.5px solid ${BORDER_TERTIARY}`,
          }}
        >
          <p
            style={{
              fontFamily: tokens.fontBody,
              fontSize: "12px",
              color: TEXT_TERTIARY,
              marginBottom: "12px",
              marginTop: 0,
              textAlign: "center",
            }}
          >
            No account? Save with your email only and we&apos;ll send you a link.
          </p>

          <form onSubmit={handleEmailOnly}>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="email"
                autoComplete="email"
                placeholder="your@email.com"
                value={emailOnly}
                onChange={(e) => setEmailOnly(e.target.value)}
                className="save-modal-input"
                style={{
                  flex: 1,
                  padding: "9px 14px",
                  fontSize: "13px",
                  fontFamily: tokens.fontBody,
                  borderRadius: "8px",
                  border: `0.5px solid ${BORDER_SECONDARY}`,
                  backgroundColor: BG_PRIMARY,
                  color: TEXT_PRIMARY,
                  minWidth: 0,
                }}
              />
              <button
                type="submit"
                disabled={isEmailLoading}
                onMouseEnter={() => setEmailBtnHover(true)}
                onMouseLeave={() => setEmailBtnHover(false)}
                style={{
                  padding: "9px 14px",
                  fontSize: "13px",
                  fontWeight: 500,
                  fontFamily: tokens.fontBody,
                  borderRadius: "8px",
                  border: `0.5px solid ${BORDER_SECONDARY}`,
                  backgroundColor:
                    emailBtnHover && !isEmailLoading ? BG_SECONDARY : "transparent",
                  color: emailBtnHover && !isEmailLoading ? TEXT_PRIMARY : TEXT_SECONDARY,
                  cursor: isEmailLoading ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                  transition: "background-color 150ms ease, color 150ms ease",
                }}
              >
                {isEmailLoading ? "Sending..." : "Send me a link"}
              </button>
            </div>

            {/* Email-only error */}
            {emailOnlyError && (
              <p
                style={{
                  fontFamily: tokens.fontBody,
                  fontSize: "12px",
                  color: DANGER,
                  marginTop: "8px",
                  marginBottom: 0,
                }}
              >
                {emailOnlyError}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
