import { AnimatePresence, motion } from "framer-motion";
import { GameComponentProps } from "./registry";
import { StandardView } from "../types";

export function StandardGame({ state, playerId, act, next }: GameComponentProps) {
  const view = state.view as StandardView;
  if (!view) return null;

  const answered = view.answeredPlayerIds.includes(playerId ?? "");

  const partner = state.meta.players.find((p) => p.id !== playerId);

  if (view.phase === "REVEAL" && view.reveal) {
    const r = view.reveal;
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="reveal"
          initial={{ opacity: 0, scale: 0.7, rotate: -3 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className={`card flex flex-col gap-4 p-6 ${r.isMatch ? "shadow-stamp" : ""}`}
        >
          <div className="flex items-center justify-between">
            <span className="eyebrow">Révélation</span>
            <span className="rounded-full border border-line bg-ink/60 px-2.5 py-0.5 font-display text-sm font-bold text-saffron">
              {view.round}/{view.totalRounds}
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {Object.entries(r.answers).map(([pid, val]) => {
              const p = state.meta.players.find((pl) => pl.id === pid);
              return (
                <div key={pid} className="flex items-center justify-between gap-3">
                  <span className="text-xs uppercase tracking-widest text-mute">{p?.displayName ?? "Joueur"}</span>
                  <span className="rounded-xl border border-line bg-ink/50 px-3 py-1.5 text-sm font-semibold text-paper">{val}</span>
                </div>
              );
            })}
          </div>

          <div className={`my-4 border-t border-dashed pt-4 text-center ${r.isMatch ? "border-leaf/40" : "border-bissap/40"}`}>
            <p className={`font-display text-xl font-black tracking-wide ${r.isMatch ? "text-leaf" : "text-bissap"}`}>
              {r.isMatch ? "Même réponse 🔥" : "Réponses différentes"}
            </p>
          </div>

          <button onClick={next} className="btn-clay w-full py-3">
            Question suivante
          </button>
        </motion.div>
      </AnimatePresence>
    );
  }

  const q = view.question;
  if (!q) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={q.cardId}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -14, scale: 0.98 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="card flex flex-col gap-4 p-6"
      >
        <div className="flex items-center justify-between">
          <span className="eyebrow">Question</span>
          <span className="rounded-full border border-line bg-ink/60 px-2.5 py-0.5 font-display text-sm font-bold text-saffron">
            {view.round}/{view.totalRounds}
          </span>
        </div>
        <h2 className="font-display text-2xl font-bold leading-snug text-paper">{q.prompt}</h2>

        <div className="flex flex-col gap-2.5">
          {q.options.map((opt, i) => (
            <motion.button
              key={opt}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.06 * i }}
              disabled={answered}
              onClick={() => act("answer", { value: opt })}
              className="group flex items-center gap-3 rounded-2xl border border-line bg-ink/40 px-4 py-3.5 text-left transition duration-200 hover:border-clay/60 hover:bg-ink3 disabled:opacity-40 disabled:hover:border-line disabled:hover:bg-ink/40"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink3 font-display text-sm font-bold text-mute transition group-hover:bg-clay group-hover:text-paper">
                {i + 1}
              </span>
              <span className="text-sm font-medium text-paper">{opt}</span>
            </motion.button>
          ))}
        </div>

        {answered && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-2 text-sm text-mute">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sand border-t-transparent" />
            En attente de la réponse de {partner?.displayName ?? "ton/ta partenaire"}…
          </motion.p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

