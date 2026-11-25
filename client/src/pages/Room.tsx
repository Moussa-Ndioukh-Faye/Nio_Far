import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../contexts/GameContext";
import { Mark, Wordmark } from "../components/Mark";
import { PresenceBadge } from "../components/PresenceBadge";
import { InviteShare } from "../components/InviteShare";
import { Confetti } from "../components/Confetti";
import { getGameComponent } from "../games/registry";
import { getCatalogEntry, CATEGORY_GLYPHS, DIFFICULTY_LABELS } from "../data/catalog";
import { FinishedView, PlayerState, RoundRecap, SessionPublicState, StandardView, TurnBasedView } from "../types";

const NAME_KEY = "niofar_name";

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function Room() {
  const { code: codeParam } = useParams<{ code: string }>();
  const urlCode = (codeParam ?? "").trim().toUpperCase();
  const {
    state,
    playerId,
    restoring,
    selfStatus,
    joinRoom,
    messages,
    partnerStatus,
    partnerTyping,
    resetSession,
    setReady,
    startGame,
    act,
    next,
    sendChat,
    notifyTyping,
    requestRematch,
  } = useGame();
  const navigate = useNavigate();
  const [chatText, setChatText] = useState("");
  const [joinName, setJoinName] = useState(() => localStorage.getItem(NAME_KEY) ?? "");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [seenCount, setSeenCount] = useState(0);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    if (chatOpen) setSeenCount(messages.length);
  }, [messages.length, partnerTyping, chatOpen]);

  // Arrivée via le lien d'invitation (/room/NF-XXXX) : pas encore membre de
  // cette room -> on propose de la rejoindre avec un prénom.
  const inThisRoom = !!state && state.meta.code === urlCode;

  async function handleInviteJoin() {
    const name = joinName.trim();
    if (!name || !urlCode) return;
    setJoining(true);
    setJoinError(null);
    localStorage.setItem(NAME_KEY, name);
    try {
      const ok = await joinRoom(name, urlCode);
      if (!ok) setJoinError("Impossible de rejoindre : code invalide, partie pleine ou expirée.");
    } catch {
      setJoinError("Le serveur ne répond pas. Réessaie dans un instant.");
    } finally {
      setJoining(false);
    }
  }

  function leave() {
    resetSession();
    navigate("/");
  }

  if (!inThisRoom && !restoring && urlCode) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card flex flex-col items-center gap-5 p-8 text-center"
        >
          <Mark size={84} />
          <h1 className="font-display text-3xl font-bold text-paper">On t'attend 💞</h1>
          <p className="text-sm text-sand">
            Tu as été invité(e) à la partie{" "}
            <span className="font-display font-bold tracking-[0.18em] text-saffron">{urlCode}</span>
          </p>
          <label htmlFor="invite-name" className="sr-only">Ton prénom</label>
          <input
            id="invite-name"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleInviteJoin(); }}
            placeholder="Ton prénom"
            maxLength={30}
            className="field text-center"
            autoFocus
          />
          {joinError && <p role="alert" className="text-sm text-bissap">{joinError}</p>}
          <button
            onClick={handleInviteJoin}
            disabled={!joinName.trim() || joining}
            className="btn-clay w-full py-3.5 text-lg"
          >
            {joining ? "Connexion…" : "Rejoindre la partie"}
          </button>
          <button onClick={leave} className="min-h-11 px-4 text-sm text-mute underline-offset-4 hover:text-sand hover:underline">
            Retour à l'accueil
          </button>
          <p className="text-xs text-mute">
            En rejoignant, ton prénom, tes réponses et tes messages sont partagés avec ton/ta partenaire et effacés sous 30 jours.{" "}
            <a href="/confidentialite" className="text-sand underline underline-offset-2">En savoir plus</a>
          </p>
        </motion.div>
      </main>
    );
  }

  if (!state || !inThisRoom) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center text-sand" aria-busy="true">
        <Mark size={52} />
        <div className="flex items-center gap-3" role="status">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-saffron border-t-transparent" />
          Connexion à la partie…
        </div>
      </main>
    );
  }

  const { meta, view } = state;
  const me = meta.players.find((p) => p.id === playerId);
  const partner = meta.players.find((p) => p.id !== playerId);
  const inviteLink = `${window.location.origin}/room/${meta.code}`;
  const catalog = getCatalogEntry(meta.gameType);
  const unread = chatOpen ? 0 : Math.max(0, messages.length - seenCount);

  const GameView = meta.family ? getGameComponent(meta.family) : null;
  const finished = meta.status === "FINISHED" && view?.kind === "FINISHED";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-6 pt-5">
      {/* ---- En-tête ---- */}
      <header className="mb-5 flex items-center justify-between gap-3">
        <button onClick={leave} className="flex min-h-11 min-w-0 items-center gap-3 text-left" title="Quitter et revenir à l'accueil">
          <Mark size={40} />
          <div className="min-w-0">
            <p className="text-xl">
              <Wordmark underline={false} />
              <span className="sr-only">, retour à l'accueil</span>
            </p>
            <p className="mt-1 truncate text-xs uppercase tracking-[0.2em] text-mute">
              {CATEGORY_GLYPHS[meta.category]} {catalog?.name ?? meta.gameType} · {DIFFICULTY_LABELS[meta.difficulty]}
            </p>
          </div>
        </button>
        <span aria-label={`Code de la partie : ${meta.code.split("").join(" ")}`} className="shrink-0 whitespace-nowrap rounded-lg border border-saffron/40 bg-saffron/10 px-2.5 py-1 font-display text-sm font-bold tracking-[0.16em] text-saffron">
          {meta.code}
        </span>
      </header>

      <main className="flex flex-1 flex-col">
      <h1 className="sr-only">
        {catalog?.name ?? meta.gameType} — partie {meta.code}
      </h1>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announce(state, playerId)}
      </p>

      {/* ---- Joueurs ---- */}
      <ul className="mb-4 grid grid-cols-2 gap-2.5" aria-label="Joueurs">
        <PresenceBadge
          name={me?.displayName ?? "Moi"}
          isConnected={selfStatus === "online"}
          isReady={meta.status === "WAITING" || meta.status === "READY" ? me?.isReady : undefined}
          isHost={me?.id === meta.hostId}
          score={meta.scoringEnabled && meta.status !== "WAITING" && meta.status !== "READY" ? me?.score : undefined}
          active={meta.family === "TURN_BASED" && meta.status === "PLAYING" && meta.turnPlayerId === me?.id}
          you
        />
        <PresenceBadge
          name={partner?.displayName ?? "En attente…"}
          isConnected={partner?.isConnected ?? false}
          isReady={meta.status === "WAITING" || meta.status === "READY" ? partner?.isReady : undefined}
          isHost={!!partner && partner.id === meta.hostId}
          score={meta.scoringEnabled && meta.status !== "WAITING" && meta.status !== "READY" ? partner?.score : undefined}
          active={meta.family === "TURN_BASED" && meta.status === "PLAYING" && !!partner && meta.turnPlayerId === partner.id}
          placeholder={!partner}
        />
      </ul>

      <AnimatePresence>
        {selfStatus === "reconnecting" && (
          <Banner key="self" tone="bissap">⚠ Ta connexion a sauté — reconnexion en cours…</Banner>
        )}
        {selfStatus === "online" && partnerStatus === "reconnecting" && partner && (
          <Banner key="partner" tone="saffron">
            ⚠ Le réseau de {partner.displayName} vacille — on le/la garde en ligne une minute.
          </Banner>
        )}
        {meta.status === "ABANDONED" && (
          <Banner key="abandoned" tone="bissap">
            La partie a été abandonnée (connexion perdue trop longtemps).{" "}
            <button onClick={leave} className="underline">Revenir à l'accueil</button>
          </Banner>
        )}
      </AnimatePresence>

      {/* ---- Salle d'attente ---- */}
      {(meta.status === "WAITING" || meta.status === "READY") && (
        <WaitingRoom
          state={state}
          me={me}
          partner={partner}
          inviteLink={inviteLink}
          description={catalog?.description}
          onReady={setReady}
          onStart={startGame}
        />
      )}

      {/* ---- Jeu ---- */}
      {meta.status === "PLAYING" && GameView && <GameView state={state} playerId={playerId} act={act} next={next} />}

      {/* ---- Fin de partie ---- */}
      {finished && (
        <FinishedScreen
          state={state}
          playerId={playerId}
          onRematch={requestRematch}
          onLeave={leave}
        />
      )}

      {/* ---- Chat ---- */}
      {partner && (
        <section className="mt-6 flex flex-col gap-2.5" aria-label="Chat">
          <button
            onClick={() => setChatOpen((o) => !o)}
            className="flex min-h-11 items-center justify-between text-left"
            aria-expanded={chatOpen}
            aria-controls="chat-panel"
          >
            <span className="eyebrow flex items-center gap-2">
              Chat · murmures
              {unread > 0 && (
                <span className="rounded-full bg-clay px-1.5 py-0.5 text-xs tracking-normal text-paper">{unread}</span>
              )}
            </span>
            <span className="text-sm text-mute">{chatOpen ? "Masquer" : "Afficher"}</span>
          </button>
          <AnimatePresence initial={false}>
            {chatOpen && (
              <motion.div
                id="chat-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex flex-col gap-2.5 overflow-hidden"
              >
                <div className="card flex h-52 flex-col overflow-hidden p-3">
                  <div
                    ref={chatScrollRef}
                    className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1"
                    role="log"
                    aria-live="polite"
                    aria-label="Messages"
                    tabIndex={0}
                  >
                    {messages.length === 0 && (
                      <p className="m-auto text-center text-xs italic text-mute">Dis quelque chose de doux, ou lâche une vérité.</p>
                    )}
                    {messages.map((m, i) => {
                      const mine = m.playerId === playerId;
                      const from = meta.players.find((pl) => pl.id === m.playerId);
                      const prev = messages[i - 1];
                      const grouped = prev && prev.playerId === m.playerId && m.createdAt - prev.createdAt < 120_000;
                      return (
                        <motion.div
                          key={m.id ?? i}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                        >
                          {!grouped && (
                            <span className="mb-0.5 px-1 text-xs uppercase tracking-widest text-mute">
                              {mine ? "toi" : from?.displayName ?? "?"} · {formatTime(m.createdAt)}
                            </span>
                          )}
                          <p
                            className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                              mine ? "rounded-br-sm bg-clay text-paper" : "rounded-bl-sm bg-ink3 text-paper"
                            }`}
                            title={formatTime(m.createdAt)}
                          >
                            {m.text}
                          </p>
                        </motion.div>
                      );
                    })}
                    <AnimatePresence>
                      {partnerTyping && (
                        <motion.div
                          key="typing"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center gap-2 px-1 text-xs italic text-sand"
                        >
                          <span className="flex gap-0.5">
                            {[0, 1, 2].map((d) => (
                              <motion.span
                                key={d}
                                className="h-1.5 w-1.5 rounded-full bg-sand"
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 1, repeat: Infinity, delay: d * 0.18 }}
                              />
                            ))}
                          </span>
                          {partner.displayName} écrit…
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!chatText.trim()) return;
                    sendChat(chatText.trim());
                    setChatText("");
                  }}
                >
                  <input
                    value={chatText}
                    onChange={(e) => {
                      setChatText(e.target.value);
                      if (e.target.value) notifyTyping();
                    }}
                    placeholder="Écris un message…"
                    maxLength={500}
                    className="field"
                    aria-label="Message"
                  />
                  <button type="submit" disabled={!chatText.trim()} className="btn-clay w-12 shrink-0 px-0" aria-label="Envoyer le message">
                    <span aria-hidden>➤</span>
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}
      </main>
    </div>
  );
}

/** Phrase lue par les lecteurs d'écran quand l'état de la partie change. */
function announce(state: SessionPublicState, playerId: string | null): string {
  const { meta, view } = state;
  const partner = meta.players.find((p) => p.id !== playerId);
  const name = partner?.displayName ?? "Ton/ta partenaire";
  if (meta.status === "WAITING") return partner ? `${name} a rejoint la partie.` : "En attente de ton/ta partenaire.";
  if (meta.status === "READY") return "Vous êtes prêts tous les deux.";
  if (meta.status === "ABANDONED") return "La partie a été abandonnée.";
  if (!view) return "";
  if (view.kind === "FINISHED") return `Partie terminée. ${view.result.coupleScorePct} pour cent. ${view.result.verdict}`;
  if (view.kind === "STANDARD") {
    const v = view as StandardView;
    if (v.phase === "REVEAL" && v.reveal) return `Révélation : ${v.reveal.isMatch ? "vous êtes en phase" : "réponses différentes"}.`;
    return `Question ${v.round} sur ${v.totalRounds} : ${v.question?.prompt ?? ""}`;
  }
  const t = view as TurnBasedView;
  const mine = t.turnPlayerId === playerId;
  if (t.phase === "CHOOSE") return mine ? "C'est ton tour : choisis ta carte." : `${name} choisit sa carte.`;
  if (t.phase === "CARD") return mine ? `À toi : ${t.card?.content ?? ""}` : `${name} relève la carte.`;
  if (t.phase === "JUDGE") return t.judgePlayerId === playerId ? "À toi de valider la réponse." : `${name} valide ta réponse.`;
  if (t.phase === "RESOLVED") return t.resolution?.result === "DONE" ? "Carte validée." : t.resolution?.result === "REJECTED" ? "Carte refusée." : "Carte passée.";
  return "";
}

function Banner({ tone, children }: { tone: "bissap" | "saffron"; children: React.ReactNode }) {
  const cls = tone === "bissap" ? "border-bissap/40 bg-bissap/10 text-bissap" : "border-saffron/40 bg-saffron/10 text-saffron";
  return (
    <motion.p
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className={`mb-4 overflow-hidden rounded-xl border px-3 py-2.5 text-center text-sm ${cls}`}
    >
      {children}
    </motion.p>
  );
}

function WaitingRoom({
  state,
  me,
  partner,
  inviteLink,
  description,
  onReady,
  onStart,
}: {
  state: SessionPublicState;
  me?: PlayerState;
  partner?: PlayerState;
  inviteLink: string;
  description?: string;
  onReady: (ready: boolean) => void;
  onStart: () => void;
}) {
  const { meta } = state;
  if (!partner) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
        <div className="flex items-center justify-center gap-2 text-center font-display font-medium text-sand">
          <motion.span animate={{ scale: [1, 1.25, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
            💌
          </motion.span>
          En attendant que ton/ta partenaire arrive…
        </div>
        <InviteShare code={meta.code} link={inviteLink} />
        {description && <p className="px-2 text-center text-xs text-mute">{description}</p>}
      </motion.div>
    );
  }

  const isHost = me?.id === meta.hostId;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card flex flex-col items-center gap-4 p-6 text-center">
      <p className="font-display text-2xl font-black text-paper">💞 Vous êtes là tous les deux</p>
      {description && <p className="text-sm text-sand">{description}</p>}
      <div className="flex flex-wrap justify-center gap-2 text-xs uppercase tracking-widest text-mute">
        <span className="rounded-full border border-line px-2.5 py-1">{meta.totalRounds} manches</span>
        {meta.timerSeconds && <span className="rounded-full border border-line px-2.5 py-1">⏱️ {meta.timerSeconds} s / question</span>}
        {meta.family === "TURN_BASED" && <span className="rounded-full border border-line px-2.5 py-1">Chacun son tour</span>}
      </div>
      {!me?.isReady ? (
        <button onClick={() => onReady(true)} className="btn-clay w-full py-3.5 text-lg">
          Je suis prêt(e)
        </button>
      ) : (
        <div className="flex w-full flex-col items-center gap-3">
          <button
            onClick={() => onReady(false)}
            className="inline-flex items-center gap-2 rounded-full border border-leaf/50 bg-leaf/15 px-4 py-1.5 text-sm font-semibold text-leaf"
            title="Annuler"
          >
            <span className="h-2 w-2 animate-pulse-soft rounded-full bg-leaf" />
            Prêt(e)
          </button>
          {meta.status === "READY" && isHost && (
            <motion.button
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={onStart}
              className="btn-clay w-full py-3.5 text-lg"
            >
              Commencer la partie 🎲
            </motion.button>
          )}
          {meta.status === "READY" && !isHost && <p className="text-xs text-mute">{partner.displayName} lance la partie…</p>}
          {meta.status !== "READY" && <p className="text-xs text-mute">On attend que {partner.displayName} soit prêt(e)…</p>}
        </div>
      )}
    </motion.div>
  );
}

function FinishedScreen({
  state,
  playerId,
  onRematch,
  onLeave,
}: {
  state: SessionPublicState;
  playerId: string | null;
  onRematch: () => void;
  onLeave: () => void;
}) {
  const { meta } = state;
  const result = (state.view as FinishedView).result;
  const [showRecap, setShowRecap] = useState(false);
  const p1 = meta.players[0];
  const p2 = meta.players[1];
  const partner = meta.players.find((p) => p.id !== playerId);
  const iVoted = !!playerId && meta.rematchVotes.includes(playerId);
  const partnerVoted = !!partner && meta.rematchVotes.includes(partner.id);
  const isTurnBased = meta.family === "TURN_BASED";
  const winner = useMemo(() => {
    if (!meta.scoringEnabled || !p1 || !p2 || p1.score === p2.score) return null;
    return p1.score > p2.score ? p1 : p2;
  }, [meta.scoringEnabled, p1, p2]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-4"
    >
      {result.coupleScorePct >= 60 && <Confetti count={48} burstKey={`end-${meta.gamesPlayed}`} />}
      <div className="card relative flex flex-col items-center gap-4 overflow-hidden p-7 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-48 rounded-full bg-clay/25 blur-3xl" />
        <span className="eyebrow">Partie terminée{meta.gamesPlayed > 1 ? ` · manche ${meta.gamesPlayed}` : ""}</span>
        <div>
          <p className="font-display text-7xl font-black leading-none text-clay">
            {result.coupleScorePct}
            <span className="text-4xl text-saffron">%</span>
          </p>
          <p className="mt-2 font-display font-medium text-sand">{isTurnBased ? "de cartes relevées" : "de complicité"}</p>
        </div>
        <p className="font-display text-xl font-bold text-paper">{result.verdict}</p>

        <div className="grid w-full grid-cols-3 gap-2">
          <Stat label={isTurnBased ? "Relevées" : "En phase"} value={result.matchingAnswers} tone="leaf" />
          <Stat label={isTurnBased ? "Passées" : "Différentes"} value={result.differentAnswers} tone="bissap" />
          <Stat label="Meilleure série" value={result.bestStreak} tone="saffron" />
        </div>

        {meta.scoringEnabled && (
          <div className="flex w-full items-end justify-between rounded-2xl border border-line bg-ink/50 px-5 py-4">
            {[p1, p2].map((p, i) =>
              p ? (
                <div key={p.id} className={i === 1 ? "text-right" : ""}>
                  <p className="text-xs uppercase tracking-widest text-mute">
                    {p.id === playerId ? "Toi" : p.displayName} {winner?.id === p.id && "👑"}
                  </p>
                  <p className="font-display text-3xl font-bold text-paper">{p.score}</p>
                </div>
              ) : null
            )}
          </div>
        )}
        <p className="text-xs italic text-mute">{result.summaryLabel}</p>
      </div>

      {/* ---- Revanche ---- */}
      <div className="flex flex-col gap-2.5">
        <button onClick={onRematch} disabled={iVoted} className="btn-clay w-full py-3.5 text-lg">
          {iVoted ? `En attente de ${partner?.displayName ?? "ton/ta partenaire"}…` : partnerVoted ? `${partner?.displayName} veut une revanche ! On y va 🔥` : "Revanche 🔁"}
        </button>
        <button onClick={onLeave} className="btn-ghost w-full py-3">
          Changer de jeu
        </button>
      </div>

      {/* ---- Récap ---- */}
      {result.rounds?.length > 0 && (
        <div className="card p-4">
          <button onClick={() => setShowRecap((s) => !s)} className="flex min-h-11 w-full items-center justify-between" aria-expanded={showRecap}>
            <span className="eyebrow">Revoir la partie ({result.rounds.length})</span>
            <span aria-hidden className="text-xs text-mute">{showRecap ? "▴" : "▾"}</span>
          </button>
          <AnimatePresence initial={false}>
            {showRecap && (
              <motion.ol
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-3 flex flex-col gap-2 overflow-hidden"
              >
                {result.rounds.map((r) => (
                  <RecapItem key={r.round} r={r} players={meta.players} playerId={playerId} />
                ))}
              </motion.ol>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "leaf" | "bissap" | "saffron" }) {
  const color = tone === "leaf" ? "text-leaf" : tone === "bissap" ? "text-bissap" : "text-saffron";
  return (
    <div className="rounded-2xl border border-line bg-ink/40 px-2 py-3">
      <p className={`font-display text-2xl font-black ${color}`}>{value}</p>
      <p className="text-xs uppercase tracking-widest text-mute">{label}</p>
    </div>
  );
}

function RecapItem({ r, players, playerId }: { r: RoundRecap; players: PlayerState[]; playerId: string | null }) {
  const icon =
    r.isMatch !== undefined ? (r.isMatch ? "💚" : "💔") : r.result === "DONE" ? "✅" : r.result === "REJECTED" ? "🙅" : "⏭️";
  const by = players.find((p) => p.id === r.byPlayerId);
  return (
    <li className="rounded-2xl border border-line bg-ink/40 px-3 py-2.5 text-left">
      <p className="flex gap-2 text-sm text-paper">
        <span>{icon}</span>
        <span className="flex-1">{r.prompt}</span>
      </p>
      {r.answers && (
        <p className="mt-1 pl-6 text-xs text-sand">
          {players.map((p) => `${p.id === playerId ? "Toi" : p.displayName} : ${r.answers?.[p.id] ?? "—"}`).join(" · ")}
        </p>
      )}
      {r.byPlayerId && (
        <p className="mt-1 pl-6 text-xs text-sand">
          {by?.id === playerId ? "Toi" : by?.displayName}
          {r.text ? ` : « ${r.text} »` : ""}
        </p>
      )}
    </li>
  );
}
