"use client";

import { ReactNode } from "react";

interface CityLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export default function CityLayout({ sidebar, children }: CityLayoutProps) {
  return (
    <div
      className="sonder-city-layout"
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "var(--color-warm)",
      }}
    >
      {/* Sidebar */}
      <aside
        className="sonder-city-sidebar"
        style={{
          width: "280px",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
          borderRight: "1px solid rgba(26,26,24,0.08)",
          padding: "var(--spacing-px-48) var(--spacing-px-32)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-px-40)",
        }}
      >
        {sidebar}
      </aside>

      {/* Scrollable content */}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "var(--spacing-px-48)",
        }}
      >
        {children}
      </main>
    </div>
  );
}
