import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../contexts/GameContext";
import { Mark } from "../components/Mark";
import { PresenceBadge } from "../components/PresenceBadge";
import { InviteShare } from "../components/InviteShare";

export function Room() {
  const {
    roomState,
    playerId,
    currentQuestion,
    lastReveal,
    partnerStatus,
    finalResult,
    setReady,
    startGame,
    submitAnswer,
    nextQuestion,
    sendChat,
    messages,
    resetSession,
  } = useGame();
  const navigate = useNavigate();
  const [chatText, setChatText] = useState("");
  const [answered, setAnswered] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  if (!roomState) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 p-8 text-center text-neutral-400">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-saffron border-t-transparent" />
        Connexion à la partie…
      </div>
    );
  }

  const me = roomState.players.find((p) => p.id === playerId);
  const partner = roomState.players.find((p) => p.id !== playerId);
  const inviteLink = `${window.location.origin}/room/${roomState.code}`;

  if (finalResult) {
    const p1 = roomState.players[0];
    const p2 = roomState.players[1];
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="card flex flex-col items-center gap-5 p-8 text-center"
        >
          <Mark size={56} />
          <h1 className="font-display text-3xl font-black text-paper">
            {finalResult.abandoned ? "Partie interrompue" : "Partie terminée"}
          </h1>
          {finalResult.abandoned ? (
            <p className="text-sm leading-relaxed text-sand">
              {finalResult.reason === "PARTNER_DISCONNECTED"
                ? "Ton/ta partenaire s'est déconnecté(e) trop longtemps."
                : "La partie a été interrompue."}
            </p>
          ) : (
            <>
              <div>
                <p className="font-display text-7xl font-black text-clay">
                  {finalResult.coupleScorePct}
                  <span className="text-4xl text-saffron">%</span>
                </p>
                <p className="mt-1 font-display italic text-sand">de complicité entre vous deux</p>
              </div>
              <div className="flex w-full justify-between rounded-2xl border border-line bg-ink/50 px-5 py-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-mute">{p1?.displayName ?? "Joueur 1"}</p>
                  <p className="font-display text-3xl font-bold text-paper">{finalResult.player1Score}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-widest text-mute">{p2?.displayName ?? "Joueur 2"}</p>
                  <p className="font-display text-3xl font-bold text-paper">{finalResult.player2Score}</p>
                </div>
              </div>
            </>
          )}

          <button
            onClick={() => {
              resetSession();
              navigate("/");
            }}
            className="btn-clay w-full py-3.5 text-lg"
          >
            Rejouer
          </button>
        </motion.div>
      </div>
    );
  }

  function handleAnswer(value: string) {
    submitAnswer(value);
    setAnswered(true);
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Mark size={38} />
          <div>
            <h1 className="font-display text-xl font-black leading-none text-paper">
              NIO <span className="italic text-clay">FAR</span>
            </h1>
            <p className="mt-0.5 text-[0.65rem] uppercase tracking-[0.24em] text-mute">{roomState.gameType.replace(/_/g, " ")}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[0.65rem] uppercase tracking-[0.24em] text-mute">Code</span>
          <span className="rounded-lg border border-saffron/40 bg-saffron/10 px-2.5 py-1 font-display text-base font-bold tracking-[0.18em] text-saffron">
            {roomState.code}
          </span>
        </div>
      </header>

      <div className="mb-4 flex gap-2.5">
        <PresenceBadge name={me?.displayName ?? "Moi"} isConnected={true} isHost={me?.id === roomState.hostId} score={me?.score} />
        <PresenceBadge
          name={partner?.displayName ?? "En attente…"}
          isConnected={partner?.isConnected ?? false}
          isReady={partner?.isReady}
          score={partner?.score}
        />
      </div>

      <AnimatePresence>
        {partnerStatus === "reconnecting" && partner && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden rounded-xl border border-saffron/40 bg-saffron/10 px-3 py-2.5 text-center text-sm text-saffron"
          >
            ⚠ Le réseau de {partner.displayName} vacille — patience, on le/la garde en ligne.
          </motion.p>
        )}
      </AnimatePresence>

      {roomState.status === "WAITING" && !partner && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
          <p className="text-center font-display italic text-sand">En attendant que ton/ta partenaire arrive…</p>
          <InviteShare code={roomState.code} link={inviteLink} />
        </motion.div>
      )}

      {partner && (roomState.status === "WAITING" || roomState.status === "READY") && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card flex flex-col items-center gap-4 p-6 text-center">
          <p className="font-display text-2xl font-black text-paper">💞 Boucle bouclée</p>
          <p className="text-sm text-sand">Vous êtes tous les deux là. Prêt·e à tout se dire ?</p>

          {!me?.isReady ? (
            <button onClick={() => setReady(true)} className="btn-clay w-full py-3.5">
              Je suis prêt(e)
            </button>
          ) : (
            <div className="flex w-full flex-col items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-leaf/50 bg-leaf/15 px-4 py-1.5 text-sm font-semibold text-leaf">
                <span className="h-2 w-2 animate-pulse-soft rounded-full bg-leaf" />
                Prêt(e)
              </span>
              {roomState.status === "READY" && me?.id === roomState.hostId && (
                <button onClick={startGame} className="btn w-full border border-clay bg-clay/15 py-3.5 text-clay hover:bg-clay/25">
                  Commencer la partie
                </button>
              )}
              {roomState.status === "READY" && me?.id !== roomState.hostId && (
                <p className="text-xs text-mute">{partner.displayName} lance quand tout est prêt…</p>
              )}
            </div>
          )}
        </motion.div>
      )}

      {roomState.status === "PLAYING" && currentQuestion && (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="card flex flex-col gap-4 p-6"
          >
            <div className="flex items-center justify-between">
              <span className="eyebrow">Question</span>
              <span className="rounded-full border border-line bg-ink/60 px-2.5 py-0.5 font-display text-sm font-bold text-saffron">
                {currentQuestion.index + 1}/{currentQuestion.total}
              </span>
            </div>
            <h2 className="font-display text-2xl font-bold leading-snug text-paper">{currentQuestion.prompt}</h2>

            <div className="flex flex-col gap-2.5">
              {currentQuestion.options.map((opt, i) => (
                <motion.button
                  key={opt}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.06 * i }}
                  disabled={answered}
                  onClick={() => handleAnswer(opt)}
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
      )}

      <AnimatePresence>
        {lastReveal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7, rotate: -3 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className={`card mt-4 p-5 ${lastReveal.isMatch ? "shadow-stamp" : ""}`}
          >
            <div className="flex flex-col gap-2.5">
              {Object.entries(lastReveal.answers).map(([pid, val]) => {
                const p = roomState.players.find((pl) => pl.id === pid);
                return (
                  <div key={pid} className="flex items-center justify-between gap-3">
                    <span className="text-xs uppercase tracking-widest text-mute">{p?.displayName ?? "Joueur"}</span>
                    <span className="rounded-xl border border-line bg-ink/50 px-3 py-1.5 text-sm font-semibold text-paper">{val}</span>
                  </div>
                );
              })}
            </div>

            <div
              className={`my-4 border-t border-dashed pt-4 text-center ${
                lastReveal.isMatch ? "border-leaf/40" : "border-bissap/40"
              }`}
            >
              <p className={`font-display text-xl font-black tracking-wide ${lastReveal.isMatch ? "text-leaf" : "text-bissap"}`}>
                {lastReveal.isMatch ? "Même réponse" : "Réponses différentes"}
              </p>
            </div>

            <button
              onClick={() => {
                setAnswered(false);
                nextQuestion();
              }}
              className="btn-clay w-full py-3"
            >
              Question suivante
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="mt-7 flex flex-col gap-3">
        <h3 className="eyebrow">Chat · murmures</h3>
        <div className="card flex h-44 flex-col overflow-hidden p-3">
          <div
            className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1"
            onScroll={(e) => {
              const el = e.currentTarget;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 12) scrollToBottom();
            }}
          >
            {messages.length === 0 && (
              <p className="m-auto text-center text-xs italic text-mute">Dit quelque chose de doux, ou lâche une vérité.</p>
            )}
            {messages.map((m, i) => {
              const mine = m.playerId === playerId;
              const from = roomState.players.find((pl) => pl.id === m.playerId);
              return (
                <div key={i} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                  <span className="mb-0.5 px-1 text-[0.6rem] uppercase tracking-widest text-mute">{mine ? "toi" : from?.displayName ?? "?"}</span>
                  <p
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                      mine ? "rounded-br-sm bg-clay text-paper" : "rounded-bl-sm bg-ink3 text-paper"
                    }`}
                  >
                    {m.text}
                  </p>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
        </div>
        <div className="flex gap-2">
          <input
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && chatText.trim()) {
                sendChat(chatText.trim());
                setChatText("");
              }
            }}
            placeholder="Écris un message…"
            maxLength={500}
            className="field"
          />
          <button
            onClick={() => {
              if (!chatText.trim()) return;
              sendChat(chatText.trim());
              setChatText("");
            }}
            className="btn-ghost shrink-0 px-4"
            aria-label="Envoyer le message"
          >
            →
          </button>
        </div>
      </section>
    </div>
  );
}