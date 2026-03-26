"use client";

import { useState } from "react";
import { tokens } from "@/lib/tokens";

export default function MagicLinkRequestForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);

    try {
      const res = await fetch("/api/magic-link-refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) throw new Error("Request failed");

      setSubmitted(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <p
        style={{
          fontFamily: tokens.fontBody,
          fontSize: tokens.textBodySm,
          color: "rgba(255,255,255,0.6)",
          lineHeight: 1.65,
          maxWidth: "380px",
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        If we have an itinerary saved for that email, we&apos;ve sent a new link. Check your inbox.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: tokens.sp12,
        width: "100%",
        maxWidth: "380px",
        margin: "0 auto",
      }}
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        required
        style={{
          width: "100%",
          padding: `${tokens.sp12} ${tokens.sp16}`,
          backgroundColor: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: tokens.radiusButton,
          color: "#fff",
          fontFamily: tokens.fontBody,
          fontSize: tokens.textBodySm,
          outline: "none",
          boxSizing: "border-box",
        }}
      />
      <button
        type="submit"
        disabled={loading}
        style={{
          width: "100%",
          padding: `${tokens.sp12} ${tokens.sp16}`,
          backgroundColor: "#fff",
          border: "none",
          borderRadius: tokens.radiusButton,
          color: tokens.ink,
          fontFamily: tokens.fontBody,
          fontSize: tokens.textBodySm,
          fontWeight: 500,
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "Sending..." : "Send me a new link"}
      </button>
      {error && (
        <p
          style={{
            fontFamily: tokens.fontBody,
            fontSize: tokens.textBodySm,
            color: "rgba(255,255,255,0.5)",
            margin: 0,
            textAlign: "center",
          }}
        >
          Something went wrong. Please try again.
        </p>
      )}
    </form>
  );
}
