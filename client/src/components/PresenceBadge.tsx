import { motion } from "framer-motion";

interface Props {
  name: string;
  isConnected: boolean;
  isReady?: boolean;
  isHost?: boolean;
  score?: number;
  /** c'est son tour (jeux tour par tour) */
  active?: boolean;
  you?: boolean;
  placeholder?: boolean;
}

export function PresenceBadge({ name, isConnected, isReady, isHost = false, score, active = false, you = false, placeholder = false }: Props) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  const status = placeholder
    ? "Invite-le/la"
    : !isConnected
      ? "Hors ligne"
      : active
        ? "Son tour"
        : isReady === true
          ? "Prêt(e)"
          : isReady === false
            ? "Pas prêt(e)"
            : "En ligne";

  return (
    <li
      className={`card relative flex min-w-0 items-center gap-2.5 px-3 py-2.5 transition ${
        active ? "border-saffron/70 shadow-glowSaffron" : ""
      } ${placeholder ? "border-dashed opacity-70" : ""}`}
    >
      <div className="relative shrink-0">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full font-display text-base font-semibold ${
            placeholder ? "bg-ink3 text-mute" : isConnected ? "bg-clay/85 text-paper" : "bg-ink3 text-sand"
          }`}
        >
          {placeholder ? "?" : initial}
        </div>
        {!placeholder && (
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink2 ${isConnected ? "bg-leaf" : "bg-mute"}`}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 truncate text-sm font-semibold text-paper">
          <span className="truncate">{name}</span>
          {isHost && (
            <span className="shrink-0 text-xs text-saffron" title="Hôte de la partie">
              <span aria-hidden>★</span>
              <span className="sr-only">(hôte)</span>
            </span>
          )}
        </p>
        <p className={`truncate text-xs uppercase tracking-wider ${active ? "text-saffron" : "text-mute"}`}>
          {you ? `Toi · ${status}` : status}
        </p>
      </div>
      {score !== undefined && (
        <motion.div
          aria-label={`${score} points`}
          key={score}
          initial={{ scale: 1.35 }}
          animate={{ scale: 1 }}
          className="shrink-0 rounded-lg bg-saffron/15 px-1.5 py-0.5 font-display text-sm font-bold tabular-nums text-saffron"
        >
          {score}
        </motion.div>
      )}
    </li>
  );
}
