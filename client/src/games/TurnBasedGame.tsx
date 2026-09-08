import { AnimatePresence, motion } from "framer-motion";
import { GameComponentProps } from "./registry";
import { TurnBasedView } from "../types";

const PHASE_LABELS: Record<string, string> = {
  TRUTH: "Vérité",
  DARE: "Action",
};

export function TurnBasedGame({ state, playerId, act, next }: GameComponentProps) {
  const view = state.view as TurnBasedView;
  if (!view) return null;

  const isMyTurn = view.turnPlayerId === playerId;
  const partner = state.meta.players.find((p) => p.id !== playerId);

  if (view.phase === "RESOLVED") {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="resolved"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="card flex flex-col items-center gap-5 p-6 text-center"
        >
          <span className="eyebrow">Résultat</span>
          <p className="text-5xl">{view.resolution?.result === "DONE" ? "✅" : "⏭️"}</p>
          <p className="font-display text-2xl font-black text-paper">
            {view.resolution?.result === "DONE" ? "Validé !" : "Passé"}
          </p>
          <p className="text-sm text-sand">
            {view.resolution?.byPlayerId === playerId ? "Tu as" : `${partner?.displayName ?? "Ton partenaire"} a`} marqué
            {state.meta.scoringEnabled ? " des points" : ""}.
          </p>
          <button onClick={next} className="btn-clay w-full py-3">
            Tour suivant
          </button>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (view.phase === "CARD" && view.card) {
    const card = view.card;
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={view.round}
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -14, scale: 0.98 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="card flex flex-col gap-4 p-6"
        >
          <div className="flex items-center justify-between">
            <span className="eyebrow">{PHASE_LABELS[card.type] ?? card.type}</span>
            <span className="rounded-full border border-line bg-ink/60 px-2.5 py-0.5 font-display text-sm font-bold text-saffron">
              {view.round}/{view.totalRounds}
            </span>
          </div>

          <p className="font-display text-2xl font-bold leading-snug text-paper">{card.content}</p>

          {!isMyTurn ? (
            <div className="flex items-center justify-center gap-2 text-sm text-mute">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sand border-t-transparent" />
              C'est au tour de {partner?.displayName ?? "ton partenaire"}…
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <button onClick={() => act("resolve", { result: "DONE" })} className="btn w-full border border-leaf bg-leaf/15 py-3.5 text-leaf hover:bg-leaf/25">
                ✅ C'est fait !
              </button>
              <button onClick={() => act("resolve", { result: "PASS" })} className="btn-ghost w-full py-3 text-sm">
                ⏭️ Passer
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    );
  }

  // CHOOSE phase
  if (!isMyTurn) {
    return (
      <div className="card flex flex-col items-center gap-4 p-6 text-center">
        <span className="eyebrow">Tour de jeu</span>
        <p className="text-sm text-sand">
          C'est au tour de <strong className="text-paper">{partner?.displayName ?? "ton partenaire"}</strong> de choisir.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-mute">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sand border-t-transparent" />
          En attente…
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="choose"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -14 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="card flex flex-col items-center gap-5 p-6 text-center"
      >
        <div className="flex items-center justify-between w-full">
          <span className="eyebrow">À toi !</span>
          <span className="rounded-full border border-line bg-ink/60 px-2.5 py-0.5 font-display text-sm font-bold text-saffron">
            {view.round}/{view.totalRounds}
          </span>
        </div>
        <p className="text-sm text-sand">Que veux-tu faire ce tour ?</p>
        <div className="flex flex-col gap-3 w-full">
          {view.options.map((opt) => (
            <button
              key={opt}
              onClick={() => act("choose", { type: opt })}
              className="btn w-full border border-clay bg-clay/15 py-4 text-lg font-display font-black text-clay hover:bg-clay/25 transition"
            >
              {opt === "TRUTH" ? "🤫 Vérité" : "🤸 Action"}
            </button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}