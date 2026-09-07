import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../contexts/GameContext";
import { PresenceBadge } from "../components/PresenceBadge";
import { InviteShare } from "../components/InviteShare";

export function Room() {
  const { roomState, playerId, currentQuestion, lastReveal, partnerStatus, setReady, startGame, submitAnswer, nextQuestion, sendChat, messages } =
    useGame();
  const [chatText, setChatText] = useState("");
  const [answered, setAnswered] = useState(false);

  if (!roomState) {
    return <div className="p-8 text-center text-neutral-400">Connexion à la partie...</div>;
  }

  const me = roomState.players.find((p) => p.id === playerId);
  const partner = roomState.players.find((p) => p.id !== playerId);
  const inviteLink = `${window.location.origin}/room/${roomState.code}`;

  function handleAnswer(value: string) {
    submitAnswer(value);
    setAnswered(true);
  }

  return (
    <div className="mx-auto min-h-screen max-w-sm px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-blush">❤️ NIO FAR</h1>
        <span className="text-xs text-neutral-500">Code : {roomState.code}</span>
      </header>

      <div className="mb-6 flex justify-between gap-2">
        <PresenceBadge name={me?.displayName ?? "Moi"} isConnected={true} />
        <PresenceBadge name={partner?.displayName ?? "En attente..."} isConnected={partner?.isConnected ?? false} />
      </div>

      {partnerStatus === "reconnecting" && partner && (
        <p className="mb-4 rounded-lg bg-yellow-900/40 px-3 py-2 text-center text-sm text-yellow-300">
          ⚠️ Ton/ta partenaire a une connexion instable...
        </p>
      )}

      {roomState.status === "WAITING" && !partner && (
        <div className="flex flex-col gap-4">
          <p className="text-center text-neutral-300">En attente de ton/ta partenaire...</p>
          <InviteShare code={roomState.code} link={inviteLink} />
        </div>
      )}

      {partner && (roomState.status === "WAITING" || roomState.status === "READY") && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-lg font-semibold">❤️ PARTIE CONNECTÉE</p>
          <p className="text-neutral-400">Vous êtes tous les deux prêts ?</p>
          <button
            onClick={() => setReady(true)}
            className="rounded-xl bg-blush px-6 py-3 font-semibold text-white hover:bg-blushDark"
          >
            Je suis prêt(e) ❤️
          </button>
          {roomState.status === "READY" && me?.id === roomState.hostId && (
            <button onClick={startGame} className="rounded-xl border border-blush px-6 py-3 font-semibold text-blush">
              COMMENCER ❤️
            </button>
          )}
        </div>
      )}

      {roomState.status === "PLAYING" && currentQuestion && (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-3"
          >
            <p className="text-sm text-neutral-500">
              Question {currentQuestion.index + 1}/{currentQuestion.total}
            </p>
            <h2 className="text-lg font-semibold">{currentQuestion.prompt}</h2>
            {currentQuestion.options.map((opt) => (
              <button
                key={opt}
                disabled={answered}
                onClick={() => handleAnswer(opt)}
                className="rounded-xl bg-neutral-900 px-4 py-3 text-left disabled:opacity-40 hover:bg-neutral-800"
              >
                {opt}
              </button>
            ))}
            {answered && <p className="text-center text-sm text-neutral-500">En attente de la réponse de ton/ta partenaire...</p>}
          </motion.div>
        </AnimatePresence>
      )}

      {lastReveal && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-4 rounded-xl bg-neutral-900 p-4">
          <div className="mb-2 border-b border-neutral-800 pb-2 text-sm">
            {Object.entries(lastReveal.answers).map(([pid, val]) => {
              const p = roomState.players.find((pl) => pl.id === pid);
              return (
                <p key={pid}>
                  {p?.displayName} : {val}
                </p>
              );
            })}
          </div>
          <p className={lastReveal.isMatch ? "text-center text-green-400" : "text-center text-red-400"}>
            {lastReveal.isMatch ? "❤️ Même réponse !" : "❌ Réponses différentes"}
          </p>
          <button
            onClick={() => {
              setAnswered(false);
              nextQuestion();
            }}
            className="mt-3 w-full rounded-xl bg-blush px-4 py-2 font-medium text-white"
          >
            Question suivante
          </button>
        </motion.div>
      )}

      <section className="mt-8">
        <h3 className="mb-2 text-sm font-semibold text-neutral-400">💬 Chat</h3>
        <div className="mb-2 h-32 overflow-y-auto rounded-xl bg-neutral-900 p-3 text-sm">
          {messages.map((m, i) => {
            const p = roomState.players.find((pl) => pl.id === m.playerId);
            return (
              <p key={i}>
                <span className="font-medium">{p?.displayName ?? "?"} :</span> {m.text}
              </p>
            );
          })}
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
            placeholder="Écris un message..."
            className="flex-1 rounded-xl bg-neutral-900 px-3 py-2 text-sm outline-none"
          />
        </div>
      </section>
    </div>
  );
}
