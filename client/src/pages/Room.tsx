import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../contexts/GameContext";
import { Mark } from "../components/Mark";
import { PresenceBadge } from "../components/PresenceBadge";
import { InviteShare } from "../components/InviteShare";
import { getGameComponent } from "../games/registry";
import { getCatalogEntry } from "../data/catalog";
import { FinishedView } from "../types";

export function Room() {
  const {
    state,
    playerId,
    messages,
    partnerStatus,
    resetSession,
    setReady,
    startGame,
    act,
    next,
    sendChat,
  } = useGame();
  const navigate = useNavigate();
  const [chatText, setChatText] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 p-8 text-center text-neutral-400">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-saffron border-t-transparent" />
        Connexion à la partie…
      </div>
    );
  }

  const { meta, view } = state;
  const me = meta.players.find((p) => p.id === playerId);
  const partner = meta.players.find((p) => p.id !== playerId);
  const inviteLink = `${window.location.origin}/room/${meta.code}`;
  const catalog = getCatalogEntry(meta.gameType);

  // ---- Finished ----
  if (meta.status === "FINISHED" && view?.kind === "FINISHED") {
    const result = (view as FinishedView).result;
    const p1 = meta.players[0];
    const p2 = meta.players[1];
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="card flex flex-col items-center gap-5 p-8 text-center"
        >
          <Mark size={56} />
          <h1 className="font-display text-3xl font-black text-paper">Partie terminée</h1>
          <p className="text-sm text-sand">{catalog?.name ?? meta.gameType}</p>
          <div>
            <p className="font-display text-7xl font-black text-clay">
              {result.coupleScorePct}
              <span className="text-4xl text-saffron">%</span>
            </p>
            <p className="mt-1 font-display italic text-sand">de complicité entre vous deux</p>
          </div>
          <div className="flex w-full justify-between rounded-2xl border border-line bg-ink/50 px-5 py-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-mute">{p1?.displayName ?? "Joueur 1"}</p>
              <p className="font-display text-3xl font-bold text-paper">{result.player1Score}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-mute">{p2?.displayName ?? "Joueur 2"}</p>
              <p className="font-display text-3xl font-bold text-paper">{result.player2Score}</p>
            </div>
          </div>
          {result.summaryLabel && (
            <p className="text-sm italic text-sand">{result.summaryLabel}</p>
          )}
          <button
            onClick={() => { resetSession(); navigate("/"); }}
            className="btn-clay w-full py-3.5 text-lg"
          >
            Rejouer
          </button>
        </motion.div>
      </div>
    );
  }

  // ---- Header ----
  function Header() {
    return (
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Mark size={38} />
          <div>
            <h1 className="font-display text-xl font-black leading-none text-paper">
              NIO <span className="italic text-clay">FAR</span>
            </h1>
            <p className="mt-0.5 text-[0.65rem] uppercase tracking-[0.24em] text-mute">
              {catalog?.name ?? meta.gameType.replace(/_/g, " ")}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[0.65rem] uppercase tracking-[0.24em] text-mute">Code</span>
          <span className="rounded-lg border border-saffron/40 bg-saffron/10 px-2.5 py-1 font-display text-base font-bold tracking-[0.18em] text-saffron">
            {meta.code}
          </span>
        </div>
      </header>
    );
  }

  // ---- Waiting / Ready ----
  function WaitingCard() {
    if (meta.status === "WAITING" && !partner) {
      return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
          <p className="text-center font-display italic text-sand">En attendant que ton/ta partenaire arrive…</p>
          <InviteShare code={meta.code} link={inviteLink} />
        </motion.div>
      );
    }

    if (partner && (meta.status === "WAITING" || meta.status === "READY")) {
      return (
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
              {meta.status === "READY" && me?.id === meta.hostId && (
                <button onClick={startGame} className="btn w-full border border-clay bg-clay/15 py-3.5 text-clay hover:bg-clay/25">
                  Commencer la partie
                </button>
              )}
              {meta.status === "READY" && me?.id !== meta.hostId && (
                <p className="text-xs text-mute">{partner.displayName} lance quand tout est prêt…</p>
              )}
            </div>
          )}
        </motion.div>
      );
    }

    return null;
  }

  // ---- Game view (via registry) ----
  const GameView = meta.family ? getGameComponent(meta.family) : null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6">
      <Header />

      <div className="mb-4 flex gap-2.5">
        <PresenceBadge name={me?.displayName ?? "Moi"} isConnected={true} isHost={me?.id === meta.hostId} score={me?.score} />
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

      {(meta.status === "WAITING" || meta.status === "READY") && <WaitingCard />}

      {meta.status === "PLAYING" && GameView && (
        <GameView state={state} playerId={playerId} act={act} next={next} />
      )}

      {/* ---- Chat ---- */}
      <section className="mt-7 flex flex-col gap-3">
        <h3 className="eyebrow">Chat · murmures</h3>
        <div className="card flex h-44 flex-col overflow-hidden p-3">
          <div
            className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1"
            onScroll={(e) => {
              const el = e.currentTarget;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 12) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            {messages.length === 0 && (
              <p className="m-auto text-center text-xs italic text-mute">Dit quelque chose de doux, ou lâche une vérité.</p>
            )}
            {messages.map((m, i) => {
              const mine = m.playerId === playerId;
              const from = meta.players.find((pl) => pl.id === m.playerId);
              return (
                <div key={i} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                  <span className="mb-0.5 px-1 text-[0.6rem] uppercase tracking-widest text-mute">{mine ? "toi" : from?.displayName ?? "?"}</span>
                  <p className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${mine ? "rounded-br-sm bg-clay text-paper" : "rounded-bl-sm bg-ink3 text-paper"}`}>
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