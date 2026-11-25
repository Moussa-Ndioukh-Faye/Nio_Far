import { motion } from "framer-motion";
import { useMemo } from "react";

const COLORS = ["#FD2B78", "#FE4D4F", "#FFFFFF", "#FFB3D1", "#A855F7"];

/** Petite pluie de confettis, sans dépendance (Framer Motion uniquement). */
export function Confetti({ count = 36, burstKey }: { count?: number; burstKey?: string | number }) {
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        drift: (Math.random() - 0.5) * 160,
        rotate: Math.random() * 720 - 360,
        delay: Math.random() * 0.25,
        duration: 1.4 + Math.random() * 1.1,
        size: 6 + Math.random() * 6,
        color: COLORS[i % COLORS.length],
        round: Math.random() > 0.6,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count, burstKey]
  );
  if (reduce) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={`${burstKey}-${p.id}`}
          initial={{ y: -20, x: 0, opacity: 1, rotate: 0 }}
          animate={{ y: "105vh", x: p.drift, opacity: [1, 1, 0], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: 0,
            width: p.size,
            height: p.round ? p.size : p.size * 0.45,
            borderRadius: p.round ? "9999px" : "2px",
            background: p.color,
          }}
        />
      ))}
    </div>
  );
}
