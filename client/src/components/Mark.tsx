interface MarkProps {
  size?: number;
  className?: string;
}

/** Blason NIO FAR : le « soleil-carte » — deux cercles concentriques, l'un vers l'autre de loin. */
export function Mark({ size = 46, className = "" }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden className={className}>
      <rect width="48" height="48" rx="13" fill="#C74B2F" />
      <rect width="48" height="48" rx="13" stroke="#E6A837" strokeOpacity="0.5" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="15.5" stroke="#F4E9D8" strokeWidth="2.4" />
      <circle cx="24" cy="24" r="9.5" stroke="#F4E9D8" strokeOpacity="0.55" strokeWidth="2.4" />
      <circle cx="24" cy="24" r="3.4" fill="#F4E9D8" />
    </svg>
  );
}