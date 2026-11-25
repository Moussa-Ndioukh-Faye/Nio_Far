import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GameComponentProps } from "./registry";
import { TurnBasedView } from "../types";
import { Confetti } from "../components/Confetti";
import { vibrate } from "../utils/haptics";

const TYPE_LABELS: Record<string, string> = {
  TRUTH: "Vérité",
  DARE: "Action",
  CHALLENGE: "Défi",
  QUESTION: "Question",
  PROMPT: "À toi",
};

const CHOICES: Record<string, { label: string; hint: string; emoji: string }> = {
  TRUTH: { label: "Vérité", hint: "Tu réponds par écrit, sincèrement.", emoji: "🤫" },
  DARE: { label: "Action", hint: "Tu le fais (vocal, photo, appel…).", emoji: "🤸" },
  CHALLENGE: { label: "Défi", hint: "Relève-le, l'autre valide.", emoji: "🎯" },
  QUESTION: { label: "Question", hint: "Réponds par écrit.", emoji: "❓" },
  PROMPT: { label: "Carte", hint: "Laisse-toi guider.", emoji: "💬" },
};

const WRITTEN = new Set(["TRUTH", "QUESTION", "PROMPT"]);

function Badge({ round, total }: { round: number; total: number }) {
  return (
    <span className="rounded-full border border-line bg-ink/60 px-2.5 py-0.5 font-display text-sm font-bold text-saffron">
      {round}/{total}
    </span>
  );
}

function Waiting({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-2 text-sm text-mute">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sand border-t-transparent" />
      {children}
    </div>
  );
}

export function TurnBasedGame({ state, playerId, act, next }: GameComponentProps) {
  const view = state.view as TurnBasedView;
  const [text, setText] = useState("");
  const lastTurnKey = useRef<string | null>(null);

  const isMyTurn = view?.turnPlayerId === playerId;
  const amJudge = view?.judgePlayerId === playerId;

  // Remet la zone de réponse à zéro à chaque nouvelle carte
  useEffect(() => setText(""), [view?.round]);

  // Vibre quand c'est à moi d'agir
  useEffect(() => {
    if (!view) return;
    const key = `${view.round}-${view.phase}`;
    if (lastTurnKey.current === key) return;
    lastTurnKey.current = key;
    if ((isMyTurn && (view.phase === "CHOOSE" || view.phase === "CARD")) || (amJudge && view.phase === "JUDGE")) vibrate(30);
    if (view.phase === "RESOLVED" && view.resolution?.result === "DONE") vibrate([40, 60, 40]);
  }, [view, isMyTurn, amJudge]);

  if (!view) return null;

  const players = state.meta.players;
  const turnPlayer = players.find((p) => p.id === view.turnPlayerId);
  const judge = players.find((p) => p.id === view.judgePlayerId);
  const card = view.card;
  const written = !!card && WRITTEN.has(card.type);

  // ---- Résultat du tour ----
  if (view.phase === "RESOLVED") {
    const res = view.resolution?.result;
    const mine = view.resolution?.byPlayerId === playerId;
    const who = mine ? "Tu" : turnPlayer?.displayName ?? "Ton/ta partenaire";
    return (
      <>
        {res === "DONE" && <Confetti count={24} burstKey={`t${view.round}`} />}
        <motion.div
          key={`resolved-${view.round}`}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="card flex flex-col items-center gap-4 p-6 text-center"
        >
          <div className="flex w-full items-center justify-between">
            <span className="eyebrow">Résultat</span>
            <Badge round={view.round} total={view.totalRounds} />
          </div>
          <p className="text-5xl">{res === "DONE" ? "✅" : res === "REJECTED" ? "🙅" : "⏭️"}</p>
          <p className="font-display text-2xl font-black text-paper">
            {res === "DONE" ? "Validé !" : res === "REJECTED" ? "Pas convaincu(e)…" : "Carte passée"}
          </p>
          {card && <p className="text-sm italic text-sand">« {card.content} »</p>}
          {view.submission?.text && (
            <p className="w-full rounded-2xl border border-line bg-ink/50 px-4 py-3 text-left text-sm text-paper">
              {view.submission.text}
            </p>
          )}
          <p className="text-xs text-mute">
            {res === "DONE"
              ? `${who} ${mine ? "as" : "a"} relevé la carte${state.meta.scoringEnabled ? " : +5 points" : ""}.`
              : res === "REJECTED"
                ? `${judge?.id === playerId ? "Tu n'as" : `${judge?.displayName ?? "L'autre"} n'a`} pas validé, pas de points ce tour.`
                : `${who} ${mine ? "as" : "a"} préféré passer.`}
          </p>
          <button onClick={next} className="btn-clay w-full py-3">
            {view.round >= view.totalRounds ? "Voir le résultat" : "Tour suivant"}
          </button>
        </motion.div>
      </>
    );
  }

  // ---- Validation par le partenaire ----
  if (view.phase === "JUDGE" && card) {
    return (
      <motion.div
        key={`judge-${view.round}`}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="card flex flex-col gap-4 p-6"
      >
        <div className="flex items-center justify-between">
          <span className="eyebrow">{amJudge ? "À toi de juger" : "Verdict en cours"}</span>
          <Badge round={view.round} total={view.totalRounds} />
        </div>
        <p className="font-display text-lg leading-snug text-sand">{card.content}</p>
        {view.submission?.text ? (
          <div className="rounded-2xl border border-saffron/30 bg-saffron/5 px-4 py-3">
            <p className="mb-1 text-xs uppercase tracking-widest text-mute">
              Réponse de {isMyTurn ? "toi" : turnPlayer?.displayName}
            </p>
            <p className="whitespace-pre-wrap text-paper">{view.submission.text}</p>
          </div>
        ) : (
          <p className="rounded-2xl border border-line bg-ink/50 px-4 py-3 text-center text-sm text-paper">
            {isMyTurn ? "Tu dis l'avoir fait 😏" : `${turnPlayer?.displayName ?? "Ton/ta partenaire"} dit l'avoir fait 😏`}
          </p>
        )}
        {amJudge ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => act("judge", { result: "REJECTED" })}
              className="btn border border-bissap/60 bg-bissap/10 py-3.5 text-bissap hover:bg-bissap/20"
            >
              🙅 Pas convaincu(e)
            </button>
            <button
              onClick={() => act("judge", { result: "DONE" })}
              className="btn border border-leaf bg-leaf/15 py-3.5 text-leaf hover:bg-leaf/25"
            >
              ✅ Validé
            </button>
          </div>
        ) : (
          <Waiting>{judge?.displayName ?? "Ton/ta partenaire"} décide si c'est validé…</Waiting>
        )}
      </motion.div>
    );
  }

  // ---- Carte en jeu ----
  if (view.phase === "CARD" && card) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={`card-${view.round}`}
          initial={{ opacity: 0, rotateY: -70 }}
          animate={{ opacity: 1, rotateY: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="card flex flex-col gap-4 p-6"
          style={{ transformPerspective: 900 }}
        >
          <div className="flex items-center justify-between">
            <span className="eyebrow">
              {CHOICES[card.type]?.emoji} {TYPE_LABELS[card.type] ?? card.type}
              {!isMyTurn && turnPlayer ? ` · ${turnPlayer.displayName}` : ""}
            </span>
            <Badge round={view.round} total={view.totalRounds} />
          </div>

          <p className="font-display text-2xl font-bold leading-snug text-paper">{card.content}</p>

          {!isMyTurn ? (
            <Waiting>
              {turnPlayer?.displayName ?? "Ton/ta partenaire"} {written ? "écrit sa réponse" : "relève le défi"}… tu valideras ensuite.
            </Waiting>
          ) : written ? (
            <div className="flex flex-col gap-3">
              <label htmlFor="turn-answer" className="sr-only">Ta réponse</label>
              <textarea
                id="turn-answer"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Ta réponse, en toute sincérité…"
                className="field resize-none"
              />
              <div className="flex items-center justify-between text-xs text-mute">
                <span>{judge?.displayName ?? "Ton/ta partenaire"} lira et validera.</span>
                <span className="tabular-nums">{text.length}/500</span>
              </div>
              <button
                onClick={() => act("submit", { text })}
                disabled={!text.trim()}
                className="btn-clay w-full py-3.5"
              >
                Envoyer ma réponse
              </button>
              <button onClick={() => act("pass")} className="btn-ghost w-full py-2.5 text-sm">
                ⏭️ Passer cette carte
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-sand">
                Fais-le pour de vrai (vocal, photo, appel vidéo…), puis préviens {judge?.displayName ?? "ton/ta partenaire"} qui validera.
              </p>
              <button onClick={() => act("submit", {})} className="btn w-full border border-leaf bg-leaf/15 py-3.5 text-leaf hover:bg-leaf/25">
                ✅ C'est fait !
              </button>
              <button onClick={() => act("pass")} className="btn-ghost w-full py-2.5 text-sm">
                ⏭️ Passer
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    );
  }

  // ---- Choix du type de carte ----
  if (!isMyTurn) {
    return (
      <div className="card flex flex-col items-center gap-4 p-6 text-center">
        <div className="flex w-full items-center justify-between">
          <span className="eyebrow">Tour de jeu</span>
          <Badge round={view.round} total={view.totalRounds} />
        </div>
        <p className="text-sm text-sand">
          <strong className="text-paper">{turnPlayer?.displayName ?? "Ton/ta partenaire"}</strong> choisit sa carte…
        </p>
        <Waiting>En attente</Waiting>
      </div>
    );
  }

  return (
    <motion.div
      key={`choose-${view.round}`}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="card flex flex-col gap-5 p-6"
    >
      <div className="flex w-full items-center justify-between">
        <span className="eyebrow">À toi !</span>
        <Badge round={view.round} total={view.totalRounds} />
      </div>
      <p className="font-display text-2xl font-black text-paper">Que choisis-tu ?</p>
      <div className="grid grid-cols-2 gap-3">
        {view.options.map((opt) => {
          const c = CHOICES[opt] ?? { label: opt, hint: "", emoji: "🎴" };
          return (
            <motion.button
              key={opt}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => act("choose", { type: opt })}
              className="flex flex-col items-center gap-2 rounded-3xl border border-clay/60 bg-gradient-to-b from-clay/20 to-clay/5 px-3 py-6 text-center transition hover:border-saffron/70"
            >
              <span className="text-4xl">{c.emoji}</span>
              <span className="font-display text-xl font-black text-paper">{c.label}</span>
              <span className="text-xs leading-snug text-sand">{c.hint}</span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
