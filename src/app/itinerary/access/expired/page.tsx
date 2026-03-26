import { tokens } from "@/lib/tokens";
import MagicLinkRequestForm from "@/components/MagicLinkRequestForm";

export default function ExpiredLinkPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: tokens.ink,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: `0 ${tokens.sp24}`,
      }}
    >
      <h1
        style={{
          fontFamily: tokens.fontDisplay,
          fontSize: "28px",
          color: "#fff",
          fontWeight: 400,
          margin: 0,
          textAlign: "center",
        }}
      >
        This link has expired.
      </h1>
      <p
        style={{
          fontFamily: tokens.fontBody,
          fontSize: tokens.textBodySm,
          color: "rgba(255,255,255,0.6)",
          lineHeight: 1.65,
          maxWidth: "380px",
          marginTop: tokens.sp12,
          marginBottom: tokens.sp32,
          textAlign: "center",
        }}
      >
        Enter the email you used to save your itinerary and we&apos;ll send you a new link.
      </p>
      <MagicLinkRequestForm />
    </div>
  );
}
