/**
 * Fond vivant : halos rose/violet/corail qui dérivent lentement derrière le
 * verre dépoli, et quelques cœurs nuit comme sur le logo.
 */
const HEARTS = [
  { left: "6%", top: "14%", size: 46, delay: "0s", opacity: 0.55 },
  { left: "82%", top: "8%", size: 120, delay: "-6s", opacity: 0.5 },
  { left: "70%", top: "22%", size: 34, delay: "-3s", opacity: 0.6 },
  { left: "88%", top: "58%", size: 54, delay: "-9s", opacity: 0.45 },
  { left: "4%", top: "68%", size: 70, delay: "-12s", opacity: 0.4 },
  { left: "44%", top: "88%", size: 40, delay: "-4s", opacity: 0.45 },
];

export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink">
      <div className="absolute -left-[20%] -top-[18%] h-[70vmax] w-[70vmax] animate-aurora rounded-full bg-[radial-gradient(circle,rgb(var(--acc)/0.32),transparent_62%)] blur-2xl" />
      <div
        className="absolute -right-[25%] top-[10%] h-[60vmax] w-[60vmax] animate-aurora rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.26),transparent_60%)] blur-2xl"
        style={{ animationDelay: "-8s" }}
      />
      <div
        className="absolute -bottom-[30%] left-[10%] h-[65vmax] w-[65vmax] animate-aurora rounded-full bg-[radial-gradient(circle,rgb(var(--acc-2)/0.2),transparent_60%)] blur-2xl"
        style={{ animationDelay: "-15s" }}
      />
      {HEARTS.map((h, i) => (
        <svg
          key={i}
          viewBox="0 0 24 22"
          className="absolute animate-drift"
          style={{ left: h.left, top: h.top, width: h.size, height: h.size, opacity: h.opacity, animationDelay: h.delay }}
        >
          <path
            d="M12 21 C 7 17, 1 13.5, 1 7.5 C 1 3.5, 4 1, 7 1 C 9.3 1, 11 2.5, 12 4 C 13 2.5, 14.7 1, 17 1 C 20 1, 23 3.5, 23 7.5 C 23 13.5, 17 17, 12 21 Z"
            fill={i === 1 ? "none" : "#2A0638"}
            stroke={i === 1 ? "#2A0638" : "none"}
            strokeWidth={i === 1 ? 2.2 : 0}
          />
        </svg>
      ))}
      {/* voile pour garder le contraste du texte */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(7,1,19,0.55)_100%)]" />
    </div>
  );
}
