interface ContainerProps {
  children: React.ReactNode;
  narrow?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function Container({
  children,
  narrow = false,
  className,
  style,
}: ContainerProps) {
  return (
    <div
      className={className}
      style={{
        width: "100%",
        maxWidth: narrow ? "680px" : "1200px",
        marginInline: "auto",
        paddingInline: "var(--spacing-px-24)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
