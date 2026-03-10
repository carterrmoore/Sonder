"use client";

interface ProgressBarProps {
  current: number; // 1-based
  total: number;
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: "4px",
        width: "50vw",
        margin: "8px auto 0",
      }}
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={total}
    >
      {Array.from({ length: total }).map((_, i) => {
        const status =
          i + 1 < current ? "complete" : i + 1 === current ? "active" : "future";
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: "3px",
              borderRadius: "2px",
              backgroundColor:
                status === "complete" || status === "active"
                  ? "var(--color-gold)"
                  : "rgba(245,240,232,0.2)",
              animation:
                status === "active"
                  ? "sonder-pulse-opacity 2s ease-in-out infinite"
                  : "none",
            }}
          />
        );
      })}
    </div>
  );
}
