interface Props {
  name: string;
  isConnected: boolean;
  isReady?: boolean;
  isHost?: boolean;
  score?: number;
}

export function PresenceBadge({ name, isConnected, isReady = false, isHost = false, score }: Props) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();

  return (
    <div className="card flex flex-1 items-center gap-3 px-4 py-3">
      <div className="relative">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full font-display text-lg font-semibold ${
            isConnected ? "bg-clay/85 text-paper" : "bg-ink3 text-sand"
          }`}
        >
          {initial}
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink2 ${
            isConnected ? "bg-leaf" : "bg-mute"
          }`}
        />
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-paper">
          {name}
          {isHost && <span className="text-[0.65rem] text-saffron" title="Hôte">★</span>}
        </p>
        <p className="text-[0.7rem] uppercase tracking-widest text-mute">
          {isConnected ? (isReady ? "Prêt(e) · en ligne" : "En ligne") : "Hors ligne"}
        </p>
      </div>
      {score !== undefined && (
        <div className="ml-auto rounded-lg bg-saffron/15 px-2 py-1 font-display text-sm font-bold text-saffron">
          {score}
        </div>
      )}
    </div>
  );
}