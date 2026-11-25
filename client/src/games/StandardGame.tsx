import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GameComponentProps } from "./registry";
import { StandardView } from "../types";
import { useGame } from "../contexts/GameContext";
import { Confetti } from "../components/Confetti";
import { vibrate } from "../utils/haptics";

/** Compte à rebours calé sur l'horloge serveur. */
function useCountdown(deadline: number | null, clockOffset: number) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!deadline) {
      setRemaining(null);
      return;
    }
    const tick = () => setRemaining(Math.max(0, deadline - (Date.now() + clockOffset)));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [deadline, clockOffset]);
  return remaining;
}

export function StandardGame({ state, playerId, act, next }: GameComponentProps) {
  const { clockOffset } = useGame();
  const view = state.view as StandardView;
  const remaining = useCountdown(view?.deadline ?? null, clockOffset);
  const lastBuzz = useRef<string | null>(null);

  const revealKey = view?.phase === "REVEAL" ? `${view.round}` : null;
  useEffect(() => {
    if (!revealKey || lastBuzz.current === revealKey) return;
    lastBuzz.current = revealKey;
    vibrate(view.reveal?.isMatch ? [40, 60, 40] : 25);
  }, [revealKey, view]);

  if (!view) return null;

  const answered = view.answeredPlayerIds.includes(playerId ?? "");
  const partner = state.meta.players.find((p) => p.id !== playerId);
  const timerTotal = (state.meta.timerSeconds ?? 0) * 1000;

  if (view.phase === "REVEAL" && view.reveal) {
    const r = view.reveal;
    return (
      <>
        {r.isMatch && <Confetti count={28} burstKey={view.round} />}
        <AnimatePresence mode="wait">
          <motion.div
            key={`reveal-${view.round}`}
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

            {view.question && <p className="font-display text-lg leading-snug text-sand">{view.question.prompt}</p>}

            <div className="flex flex-col gap-2.5">
              {state.meta.players.map((p) => {
                const shown = r.display?.[p.id] ?? r.answers[p.id] ?? "—";
                const delta = r.scoreDelta[p.id] ?? 0;
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-mute">
                      {p.id === playerId ? "Toi" : p.displayName}
                      {r.fastestPlayerId === p.id && <span title="Le/la plus rapide">⚡</span>}
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className={`rounded-xl border px-3 py-1.5 text-sm font-semibold ${
                          r.timedOut.includes(p.id) ? "border-bissap/40 text-bissap" : "border-line bg-ink/50 text-paper"
                        }`}
                      >
                        {shown}
                      </span>
                      {delta > 0 && <span className="font-display text-sm font-bold text-leaf">+{delta}</span>}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className={`my-2 border-t border-dashed pt-4 text-center ${r.isMatch ? "border-leaf/40" : "border-bissap/40"}`}>
              <p className={`font-display text-xl font-black tracking-wide ${r.isMatch ? "text-leaf" : "text-bissap"}`}>
                {r.isMatch ? "En phase 🔥" : r.timedOut.length > 0 ? "Trop lent… ⏱️" : "Pas d'accord 😅"}
              </p>
            </div>

            <button onClick={next} className="btn-clay w-full py-3">
              {view.round >= view.totalRounds ? "Voir le résultat" : "Question suivante"}
            </button>
          </motion.div>
        </AnimatePresence>
      </>
    );
  }

  const q = view.question;
  if (!q) return null;
  const pct = remaining !== null && timerTotal > 0 ? Math.min(100, (remaining / timerTotal) * 100) : null;
  const urgent = remaining !== null && remaining <= 3000;

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
          <div className="flex items-center gap-2">
            {remaining !== null && (
              <span
                className={`font-display text-sm font-bold tabular-nums ${urgent ? "animate-pulse text-bissap" : "text-sand"}`}
                aria-label={`${Math.ceil(remaining / 1000)} secondes restantes`}
                role="timer"
              >
                ⏱️ {Math.ceil(remaining / 1000)} s
              </span>
            )}
            <span className="rounded-full border border-line bg-ink/60 px-2.5 py-0.5 font-display text-sm font-bold text-saffron">
              {view.round}/{view.totalRounds}
            </span>
          </div>
        </div>

        {pct !== null && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink3" role="progressbar" aria-valuenow={Math.round(pct)}>
            <div
              className={`h-full rounded-full transition-[width] duration-100 ease-linear ${urgent ? "bg-bissap" : "bg-saffron"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        <h2 className="font-display text-2xl font-bold leading-snug text-paper">{q.prompt}</h2>

        <div className="flex flex-col gap-2.5">
          {q.options.map((opt, i) => (
            <motion.button
              key={opt}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.06 * i }}
              disabled={answered || remaining === 0}
              onClick={() => {
                vibrate(15);
                act("answer", { value: opt });
              }}
              className="group flex items-center gap-3 rounded-2xl border border-line bg-ink/40 px-4 py-3.5 text-left transition duration-200 hover:border-clay/60 hover:bg-ink3 disabled:opacity-40 disabled:hover:border-line disabled:hover:bg-ink/40"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink3 font-display text-sm font-bold text-mute transition group-hover:bg-clay group-hover:text-paper">
                {i + 1}
              </span>
              <span className="text-sm font-medium text-paper">
                {opt === "MOI" ? "Moi" : opt === "MON PARTENAIRE" ? partner?.displayName ?? "Mon/ma partenaire" : opt}
              </span>
            </motion.button>
          ))}
        </div>

        {answered && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-2 text-sm text-mute">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sand border-t-transparent" />
            En attente de la réponse de {partner?.displayName ?? "ton/ta partenaire"}…
          </motion.p>
        )}
        {!answered && partner && view.answeredPlayerIds.includes(partner.id) && (
          <p className="text-center text-xs italic text-sand">{partner.displayName} a déjà répondu 👀</p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
