"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tokens } from "@/lib/tokens";
import { Nav } from "@/components";
import { UpgradeStrip } from "@/components/UpgradeStrip";
import { SaveModal } from "@/components/SaveModal";
import type { ItineraryDay, ItinerarySlot, Itinerary } from "@/types/itinerary";
import type { EntryMetaHint } from "@/types/handoff-types";

// ── Color constants ────────────────────────────────────────────────────────────

const BG_PRIMARY     = "#fff";
const BG_SECONDARY   = "#ece7de";
const TEXT_PRIMARY   = tokens.ink;
const TEXT_SECONDARY = "rgba(26, 26, 24, 0.65)";
const TEXT_TERTIARY  = "rgba(26, 26, 24, 0.40)";
const BORDER_PRIMARY   = "rgba(26, 26, 24, 0.20)";
const BORDER_SECONDARY = "rgba(26, 26, 24, 0.12)";
const BORDER_TERTIARY  = "rgba(26, 26, 24, 0.08)";
const GOLD = "#C4922A";

// ── Types ──────────────────────────────────────────────────────────────────────

// entry_meta may be enriched with booking fields in a future pipeline pass
type ExtendedEntryMeta = EntryMetaHint & {
  booking_tier?: number;
  booking_url?: string;
};

export interface ItineraryViewProps {
  itinerary: {
    id: string;
    user_id: string | null;
    total_days: number;
    days: ItineraryDay[];
    entry_meta: Record<string, ExtendedEntryMeta> | null;
    trip_narrative: string | null;
    finalised_at: string;
  };
  isOwner: boolean;
  isMagicLinkSession: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function getPrimaryNeighbourhood(days: ItineraryDay[]): string {
  return mostFrequent(
    days.flatMap((day) => day.slots.map((slot) => slot.entrySnapshot.neighbourhood))
  );
}

function getDayNeighbourhood(day: ItineraryDay): string {
  // Try most-frequent neighbourhood across all slots
  const n = mostFrequent(day.slots.map((slot) => slot.entrySnapshot.neighbourhood));
  if (n) return n;
  // Try first slot explicitly (handles single-slot days)
  const first = day.slots[0]?.entrySnapshot.neighbourhood;
  if (first) return first;
  // Final fallback
  return `Day ${day.dayNumber}`;
}

function getBookingLabel(category: string): string {
  if (category === "restaurant") return "Reserve";
  if (category === "accommodation") return "Book stay";
  return "Book";
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getDayOfWeek(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function ShareIcon() {
  return (
    <svg
      width="13" height="13" viewBox="0 0 16 16"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <circle cx="12" cy="3" r="1.5" />
      <circle cx="12" cy="13" r="1.5" />
      <circle cx="3" cy="8" r="1.5" />
      <line x1="10.55" y1="3.91" x2="4.45" y2="7.09" />
      <line x1="10.55" y1="12.09" x2="4.45" y2="8.91" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="13" height="13" viewBox="0 0 16 16"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <path d="M2 12v2h12v-2" />
      <path d="M8 2v8" />
      <path d="M5 7l3 3 3-3" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      width="13" height="13" viewBox="0 0 16 16"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <path d="M11 2l3 3-9 9H2v-3l9-9z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg
      width="13" height="13" viewBox="0 0 16 16"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect x="2" y="4" width="12" height="9" rx="1" />
      <path d="M2 4l6 5 6-5" />
    </svg>
  );
}

// ── Slot card ──────────────────────────────────────────────────────────────────

interface SlotCardProps {
  slot: ItinerarySlot;
  entryMeta: Record<string, ExtendedEntryMeta> | null;
}

function SlotCard({ slot, entryMeta }: SlotCardProps) {
  const [hovered, setHovered] = useState(false);
  const { name, neighbourhood, editorial_hook, category } = slot.entrySnapshot;
  const meta = entryMeta?.[slot.entryId];
  const hasBooking =
    meta?.booking_url != null &&
    (meta.booking_tier === 1 || meta.booking_tier === 2);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        borderRadius: "8px",
        border: `0.5px solid ${hovered ? BORDER_PRIMARY : BORDER_TERTIARY}`,
        padding: "12px 14px",
        paddingRight: hasBooking ? "68px" : "14px",
        background: BG_PRIMARY,
        position: "relative",
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

      {hasBooking && meta?.booking_url && (
        <a
          href={meta.booking_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            fontSize: "10px",
            fontWeight: 500,
            fontFamily: tokens.fontBody,
            padding: "3px 8px",
            borderRadius: "20px",
            background: "#FEF3E8",
            color: "#854F0B",
            border: "0.5px solid #EF9F27",
            cursor: "pointer",
            textDecoration: "none",
          }}
        >
          {getBookingLabel(category)}
        </a>
      )}
    </div>
  );
}

// ── Day block ──────────────────────────────────────────────────────────────────

interface DayBlockProps {
  day: ItineraryDay;
  entryMeta: Record<string, ExtendedEntryMeta> | null;
}

function DayBlock({ day, entryMeta }: DayBlockProps) {
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
          <SlotCard slot={slot} entryMeta={entryMeta} />
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

type ReminderStatus = "idle" | "sending" | "sent" | "error";

export function ItineraryView({
  itinerary,
  isOwner,
  isMagicLinkSession,
}: ItineraryViewProps) {
  const router = useRouter();

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Share state
  const [shareCopied, setShareCopied] = useState(false);

  // Button hovers
  const [shareHover, setShareHover] = useState(false);
  const [exportHover, setExportHover] = useState(false);
  const [editHover, setEditHover] = useState(false);
  const [sidebarShareHover, setSidebarShareHover] = useState(false);
  const [reminderHover, setReminderHover] = useState(false);
  const [endShareHover, setEndShareHover] = useState(false);
  const [endAccountHover, setEndAccountHover] = useState(false);

  // Reminders
  const [showReminderInput, setShowReminderInput] = useState(false);
  const [reminderEmail, setReminderEmail] = useState("");
  const [reminderStatus, setReminderStatus] = useState<ReminderStatus>("idle");

  // ── Derived values ─────────────────────────────────────────────────────────

  const entryCount = itinerary.days.reduce((sum, day) => sum + day.slots.length, 0);
  const primaryNeighbourhood = getPrimaryNeighbourhood(itinerary.days);
  const startDate = itinerary.days[0]?.date ?? null;
  const endDate = itinerary.days[itinerary.days.length - 1]?.date ?? null;
  const eyebrowDates =
    startDate && endDate
      ? `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`
      : null;

  // Bookable slots — hidden until entry_meta is enriched with booking fields
  const bookableSlots: Array<{ slot: ItinerarySlot; dayNumber: number }> =
    itinerary.entry_meta
      ? itinerary.days.flatMap((day) =>
          day.slots.flatMap((slot) => {
            const meta = itinerary.entry_meta?.[slot.entryId];
            if (
              meta?.booking_url != null &&
              (meta.booking_tier === 1 || meta.booking_tier === 2)
            ) {
              return [{ slot, dayNumber: day.dayNumber }];
            }
            return [];
          })
        )
      : [];

  // Reconstruct Itinerary shape that SaveModal expects
  const itineraryForModal: Itinerary = {
    id: itinerary.id,
    citySlug: "krakow",
    createdAt: itinerary.finalised_at,
    updatedAt: itinerary.finalised_at,
    tripLength: itinerary.total_days,
    days: itinerary.days,
  };

  const itinerarySummary = {
    cityName: "Kraków",
    tripLength: itinerary.total_days,
    entryCount,
    focusNeighbourhood: primaryNeighbourhood,
    startDate,
    endDate,
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleShare() {
    try {
      const res = await fetch(`/api/itineraries/${itinerary.id}/share`, {
        method: "POST",
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        await navigator.clipboard.writeText(data.url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      }
    } catch {
      // silently ignore — button returns to default state
    }
  }

  async function handleSendReminder() {
    if (!reminderEmail) return;
    setReminderStatus("sending");
    try {
      const res = await fetch("/api/email-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: reminderEmail,
          itineraryId: itinerary.id,
          citySlug: "krakow",
          cityDisplayName: "Kraków",
          cityId: "21b778e8-0b37-4adc-ae10-5a226929c59c",
        }),
      });
      setReminderStatus(res.ok ? "sent" : "error");
    } catch {
      setReminderStatus("error");
    }
  }

  // ── Style helpers ──────────────────────────────────────────────────────────

  function outlineBtn(hovered: boolean): React.CSSProperties {
    return {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      fontFamily: tokens.fontBody,
      fontSize: "12px",
      fontWeight: 500,
      padding: "8px 14px",
      borderRadius: "8px",
      border: `0.5px solid ${BORDER_SECONDARY}`,
      backgroundColor: hovered ? BG_SECONDARY : BG_PRIMARY,
      color: hovered ? TEXT_PRIMARY : TEXT_SECONDARY,
      cursor: "pointer",
      transition: "background-color 150ms ease, color 150ms ease",
    };
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ backgroundColor: BG_PRIMARY, minHeight: "100vh" }}>
      <Nav />

      {isMagicLinkSession && (
        <UpgradeStrip onOpenModal={() => setIsModalOpen(true)} />
      )}

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
            Kraków, Poland{eyebrowDates ? ` · ${eyebrowDates}` : ""}
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
            Your Kraków itinerary
          </h1>

          <div
            style={{
              fontFamily: tokens.fontBody,
              fontSize: "13px",
              color: TEXT_SECONDARY,
            }}
          >
            {itinerary.total_days} days
            {entryCount > 0 ? ` · ${entryCount} entries` : ""}
            {primaryNeighbourhood ? ` · ${primaryNeighbourhood} focus` : ""}
          </div>
        </div>

        {/* Action buttons */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: "8px",
            flexShrink: 0,
            marginTop: "2px",
          }}
        >
          {(isOwner || isMagicLinkSession) && (
            <button
              type="button"
              onClick={handleShare}
              onMouseEnter={() => setShareHover(true)}
              onMouseLeave={() => setShareHover(false)}
              style={outlineBtn(shareHover)}
            >
              <ShareIcon />
              {shareCopied ? "Copied!" : "Copy link"}
            </button>
          )}

          {isOwner && (
            <>
              <button
                type="button"
                onClick={() => window.print()}
                onMouseEnter={() => setExportHover(true)}
                onMouseLeave={() => setExportHover(false)}
                style={outlineBtn(exportHover)}
              >
                <DownloadIcon />
                Export
              </button>

              <button
                type="button"
                onClick={() => router.push(`/krakow/plan?edit=${itinerary.id}`)}
                onMouseEnter={() => setEditHover(true)}
                onMouseLeave={() => setEditHover(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontFamily: tokens.fontBody,
                  fontSize: "12px",
                  fontWeight: 500,
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: editHover ? "#b8831f" : GOLD,
                  color: "#fff",
                  cursor: "pointer",
                  transition: "background-color 150ms ease",
                }}
              >
                <EditIcon />
                Make changes
              </button>
            </>
          )}
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
        <div style={{ flex: 1 }}>
          {itinerary.days.map((day) => (
            <DayBlock key={day.dayNumber} day={day} entryMeta={itinerary.entry_meta} />
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
              That&apos;s your Kraków trip.
            </div>

            <p
              style={{
                fontFamily: tokens.fontBody,
                fontSize: "13px",
                color: TEXT_SECONDARY,
                lineHeight: 1.65,
                margin: "0 0 16px",
                maxWidth: "480px",
              }}
            >
              Send this itinerary to someone you&apos;re travelling with, or save it to
              your account to access it from any device.
            </p>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleShare}
                onMouseEnter={() => setEndShareHover(true)}
                onMouseLeave={() => setEndShareHover(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontFamily: tokens.fontBody,
                  fontSize: "12px",
                  fontWeight: 500,
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: endShareHover ? "#b8831f" : GOLD,
                  color: "#fff",
                  cursor: "pointer",
                  transition: "background-color 150ms ease",
                }}
              >
                <ShareIcon />
                {shareCopied ? "Copied!" : "Share this itinerary"}
              </button>

              {isMagicLinkSession && (
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  onMouseEnter={() => setEndAccountHover(true)}
                  onMouseLeave={() => setEndAccountHover(false)}
                  style={outlineBtn(endAccountHover)}
                >
                  Create an account
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right column — sidebar */}
        <div style={{ position: "sticky", top: "20px" }}>

            {/* Things to book */}
            <div
              style={{
                borderRadius: "12px",
                border: `0.5px solid ${BORDER_TERTIARY}`,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  fontFamily: tokens.fontBody,
                  fontSize: "12px",
                  fontWeight: 500,
                  color: TEXT_PRIMARY,
                  padding: "12px 16px",
                  borderBottom: `0.5px solid ${BORDER_TERTIARY}`,
                }}
              >
                Things to book
              </div>

              <div style={{ padding: "14px 16px" }}>
                {bookableSlots.length === 0 ? (
                  <p
                    style={{
                      fontFamily: tokens.fontBody,
                      fontSize: "12px",
                      color: TEXT_SECONDARY,
                      margin: 0,
                    }}
                  >
                    Nothing to book ahead for this trip.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {bookableSlots.map(({ slot, dayNumber }) => {
                      const meta = itinerary.entry_meta?.[slot.entryId];
                      return (
                        <div
                          key={slot.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontFamily: tokens.fontBody,
                                fontSize: "12px",
                                fontWeight: 500,
                                color: TEXT_PRIMARY,
                              }}
                            >
                              {slot.entrySnapshot.name}
                            </div>
                            <div
                              style={{
                                fontFamily: tokens.fontBody,
                                fontSize: "11px",
                                color: TEXT_TERTIARY,
                              }}
                            >
                              Day {dayNumber}
                            </div>
                          </div>

                          {meta?.booking_url && (
                            <a
                              href={meta.booking_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: "10px",
                                fontWeight: 500,
                                fontFamily: tokens.fontBody,
                                padding: "3px 8px",
                                borderRadius: "20px",
                                background: "#FEF3E8",
                                color: "#854F0B",
                                border: "0.5px solid #EF9F27",
                                cursor: "pointer",
                                textDecoration: "none",
                                whiteSpace: "nowrap",
                                flexShrink: 0,
                              }}
                            >
                              {getBookingLabel(slot.entrySnapshot.category)}
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Share card */}
            <div
              style={{
                borderRadius: "12px",
                border: `0.5px solid ${BORDER_TERTIARY}`,
                padding: "16px",
                marginTop: "14px",
              }}
            >
              <div
                style={{
                  fontFamily: tokens.fontBody,
                  fontSize: "13px",
                  fontWeight: 500,
                  color: TEXT_PRIMARY,
                  marginBottom: "4px",
                }}
              >
                Share this itinerary
              </div>

              <p
                style={{
                  fontFamily: tokens.fontBody,
                  fontSize: "12px",
                  color: TEXT_SECONDARY,
                  lineHeight: 1.55,
                  margin: "0 0 12px",
                }}
              >
                Send your trip to a travel companion or keep a link for yourself.
              </p>

              <button
                type="button"
                onClick={handleShare}
                onMouseEnter={() => setSidebarShareHover(true)}
                onMouseLeave={() => setSidebarShareHover(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  width: "100%",
                  fontFamily: tokens.fontBody,
                  fontSize: "12px",
                  fontWeight: 500,
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: `0.5px solid ${BORDER_SECONDARY}`,
                  backgroundColor: sidebarShareHover ? BG_SECONDARY : BG_PRIMARY,
                  color: sidebarShareHover ? TEXT_PRIMARY : TEXT_SECONDARY,
                  cursor: "pointer",
                  transition: "background-color 150ms ease, color 150ms ease",
                  boxSizing: "border-box",
                }}
              >
                <ShareIcon />
                {shareCopied ? "Link copied" : "Copy share link"}
              </button>
            </div>

            {/* Trip reminders (owner or magic link) */}
            {(isOwner || isMagicLinkSession) && (
              <div
                style={{
                  borderRadius: "12px",
                  border: `0.5px solid ${BORDER_TERTIARY}`,
                  padding: "16px",
                  marginTop: "14px",
                  backgroundColor: BG_SECONDARY,
                }}
              >
                <div
                  style={{
                    fontFamily: tokens.fontBody,
                    fontSize: "13px",
                    fontWeight: 500,
                    color: TEXT_PRIMARY,
                    marginBottom: "4px",
                  }}
                >
                  Get reminders before you go
                </div>

                <p
                  style={{
                    fontFamily: tokens.fontBody,
                    fontSize: "12px",
                    color: TEXT_SECONDARY,
                    lineHeight: 1.55,
                    margin: "0 0 12px",
                  }}
                >
                  We&apos;ll send your itinerary two weeks before and the morning of Day
                  1, with any venue updates.
                </p>

                {reminderStatus === "sent" ? (
                  <p
                    style={{
                      fontFamily: tokens.fontBody,
                      fontSize: "12px",
                      color: TEXT_SECONDARY,
                      margin: 0,
                    }}
                  >
                    You&apos;re set. We&apos;ll send you a reminder before your trip.
                  </p>
                ) : showReminderInput ? (
                  <>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={reminderEmail}
                        onChange={(e) => setReminderEmail(e.target.value)}
                        style={{
                          flex: 1,
                          padding: "8px 10px",
                          fontSize: "12px",
                          fontFamily: tokens.fontBody,
                          borderRadius: "8px",
                          border: `0.5px solid ${BORDER_SECONDARY}`,
                          backgroundColor: BG_PRIMARY,
                          color: TEXT_PRIMARY,
                          minWidth: 0,
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleSendReminder}
                        disabled={reminderStatus === "sending"}
                        style={{
                          padding: "8px 12px",
                          fontSize: "12px",
                          fontWeight: 500,
                          fontFamily: tokens.fontBody,
                          borderRadius: "8px",
                          border: `0.5px solid ${BORDER_SECONDARY}`,
                          backgroundColor: BG_PRIMARY,
                          color: TEXT_PRIMARY,
                          cursor: reminderStatus === "sending" ? "not-allowed" : "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {reminderStatus === "sending" ? "..." : "Send"}
                      </button>
                    </div>
                    {reminderStatus === "error" && (
                      <p
                        style={{
                          fontFamily: tokens.fontBody,
                          fontSize: "12px",
                          color: "#c0392b",
                          margin: "6px 0 0",
                        }}
                      >
                        Something went wrong. Please try again.
                      </p>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowReminderInput(true)}
                    onMouseEnter={() => setReminderHover(true)}
                    onMouseLeave={() => setReminderHover(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      width: "100%",
                      fontFamily: tokens.fontBody,
                      fontSize: "12px",
                      fontWeight: 500,
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: `0.5px solid ${BORDER_SECONDARY}`,
                      backgroundColor: reminderHover ? BG_PRIMARY : "transparent",
                      color: reminderHover ? TEXT_PRIMARY : TEXT_SECONDARY,
                      cursor: "pointer",
                      transition: "background-color 150ms ease, color 150ms ease",
                      boxSizing: "border-box",
                    }}
                  >
                    <EmailIcon />
                    Send me trip reminders
                  </button>
                )}
              </div>
            )}
        </div>
      </div>

      {/* Save modal */}
      {isModalOpen && (
        <SaveModal
          isOpen={isModalOpen}
          itineraryId={itinerary.id}
          itinerary={itineraryForModal}
          itinerarySummary={itinerarySummary}
          onSaveComplete={() => {
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
