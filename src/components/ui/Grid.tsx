interface GridProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function Grid({ children, className, style }: GridProps) {
  return (
    <div
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: "var(--spacing-px-24)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
