import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Mark, Wordmark } from "../components/Mark";
import { ACCENTS, applyAccent, savedAccent } from "../theme";
import { InstallButton } from "../components/PwaPrompts";
import { useGame } from "../contexts/GameContext";
import { SERVER_URL } from "../socket";
import {
  GAME_CATALOG,
  CATEGORIES_ORDER,
  CATEGORY_LABELS,
  CATEGORY_GLYPHS,
  CATEGORY_ACCENTS,
  DIFFICULTY_LABELS,
  DIFFICULTY_GLYPHS,
  DIFFICULTY_HINTS,
  getFavorites,
  toggleFavorite,
} from "../data/catalog";
import { Category, Difficulty, GameCatalogEntry, HistoryEntry, SessionStatus } from "../types";

const NAME_KEY = "niofar_name";
const DIFF_KEY = "niofar_difficulty";
const PREVIEW_COUNT = 6; // multiple de 2 (mobile) et de 3 (ordinateur)

const STATUS_LABELS: Record<SessionStatus, string> = {
  WAITING: "En attente",
  READY: "Prête",
  PLAYING: "En cours",
  REVEALING: "En cours",
  FINISHED: "Terminée",
  ABANDONED: "Abandonnée",
};

/** « 82k7 », « nf82k7 », « NF-82K7 » -> « NF-82K7 » */
function normalizeCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = clean.startsWith("NF") ? clean.slice(2) : clean;
  return body ? `NF-${body.slice(0, 4)}` : "";
}

type Filter = Category | "FAVORIS" | null;

export function Home() {
  const navigate = useNavigate();
  const { createRoom, joinRoom, deviceId } = useGame();
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? "");
  const [filter, setFilter] = useState<Filter>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>(() => (localStorage.getItem(DIFF_KEY) as Difficulty) || "SOFT");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => getFavorites());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showAllGames, setShowAllGames] = useState(false);
  const [selected, setSelected] = useState<GameCatalogEntry | null>(null);
  const [nudgeName, setNudgeName] = useState(false);

  // Raccourcis de l'app installée : /?jeu=TRUTH_OR_DARE ouvre directement la fiche du jeu
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("jeu");
    const g = wanted ? GAME_CATALOG.find((x) => x.type === wanted) : null;
    if (g) setSelected(g);
  }, []);

  const filtered = useMemo(() => {
    if (filter === "FAVORIS") return GAME_CATALOG.filter((g) => favorites.includes(g.type));
    return filter ? GAME_CATALOG.filter((g) => g.category === filter) : GAME_CATALOG;
  }, [filter, favorites]);

  useEffect(() => {
    localStorage.setItem(NAME_KEY, name);
    if (name.trim()) setNudgeName(false);
  }, [name]);

  useEffect(() => {
    localStorage.setItem(DIFF_KEY, difficulty);
  }, [difficulty]);

  useEffect(() => {
    fetch(`${SERVER_URL}/api/me/history?deviceId=${encodeURIComponent(deviceId)}`)
      .then((r) => (r.ok ? r.json() : { history: [] }))
      .then((data) => setHistory(Array.isArray(data) ? data : (data?.history ?? [])))
      .catch(() => {});
  }, [deviceId]);

  const gamesToShow = showAllGames || filter ? filtered : filtered.slice(0, PREVIEW_COUNT);

  function requireName(): boolean {
    if (name.trim()) return true;
    setNudgeName(true);
    nameRef.current?.focus();
    nameRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }

  async function handlePlay(gameType: string, diff: Difficulty) {
    if (!requireName()) {
      setSelected(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await createRoom(name.trim(), gameType as GameCatalogEntry["type"], diff);
      if (res) navigate(`/room/${res.code}`);
      else setError("Impossible de créer la partie. Réessaie dans un instant.");
    } catch {
      setError("Le serveur ne répond pas. Vérifie ta connexion.");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    const code = normalizeCode(joinCode);
    if (!requireName() || code.length !== 7) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await joinRoom(name.trim(), code);
      if (ok) navigate(`/room/${code}`);
      else setError("Code introuvable, partie pleine ou expirée.");
    } catch {
      setError("Le serveur ne répond pas. Vérifie ta connexion.");
    } finally {
      setBusy(false);
    }
  }

  function toggleFav(type: string) {
    setFavorites(toggleFavorite(type));
  }

  const joinReady = normalizeCode(joinCode).length === 7;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-6 pt-8 md:max-w-3xl">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-xl focus:bg-ink2 focus:px-4 focus:py-2">
        Aller au contenu
      </a>
      {/* ---- Hero ---- */}
      <header className="mb-8 flex flex-col items-center gap-4 text-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14 }}>
          <div className="animate-float drop-shadow-[0_18px_40px_rgb(var(--acc)/0.35)]">
            <Mark size={104} />
          </div>
        </motion.div>
        <div>
          <h1 className="text-6xl">
            <Wordmark />
          </h1>
          <p className="mt-5 font-display text-lg font-medium text-sand">Jouez. Découvrez-vous. Rapprochez-vous.</p>
          <p className="mt-1 text-xs uppercase tracking-[0.24em] text-mute">
            {GAME_CATALOG.length} jeux · chacun sur son téléphone
          </p>
        </div>
        <InstallButton />
      </header>

      <main id="contenu" className="flex flex-1 flex-col">

      <div className="flex flex-col gap-4 md:grid md:grid-cols-2">
        {/* ---- Prénom ---- */}
        <section className={`card flex flex-col gap-2 p-4 transition ${nudgeName ? "border-saffron/70 shadow-glowSaffron" : ""}`}>
          <label htmlFor="name" className="eyebrow">Ton prénom</label>
          <input
            id="name"
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. Awa"
            className="field"
            maxLength={24}
            autoComplete="given-name"
          />
          <p className={`text-xs ${nudgeName ? "text-saffron" : "text-mute"}`}>
            {nudgeName ? "Entre ton prénom pour jouer 🙂" : "C'est ce que ton/ta partenaire verra."}
          </p>
        </section>

        {/* ---- Rejoindre ---- */}
        <section className="card flex flex-col gap-2 p-4">
          <label htmlFor="code" className="eyebrow">Tu as reçu un code ?</label>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleJoin();
            }}
          >
            <input
              id="code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onBlur={() => joinCode && setJoinCode(normalizeCode(joinCode))}
              placeholder="NF-82K7"
              className="field flex-1 font-display tracking-[0.18em]"
              maxLength={8}
              autoCapitalize="characters"
              autoComplete="off"
              inputMode="text"
            />
            <button type="submit" disabled={busy || !joinReady} className="btn-clay shrink-0 px-5">
              Rejoindre
            </button>
          </form>
          <p className="text-xs text-mute">Ou ouvre directement le lien d'invitation.</p>
        </section>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 rounded-xl border border-bissap/40 bg-bissap/10 px-3 py-2.5 text-center text-sm text-bissap"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* ---- Jeux ---- */}
      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-2xl font-black text-paper">Choisis un jeu</h2>
          <span className="text-xs text-mute">{filtered.length} jeu{filtered.length > 1 ? "x" : ""}</span>
        </div>

        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="group" aria-label="Filtrer par catégorie">
          <Chip active={filter === null} onClick={() => setFilter(null)}>✨ Tous</Chip>
          {favorites.length > 0 && (
            <Chip active={filter === "FAVORIS"} onClick={() => setFilter("FAVORIS")}>❤️ Favoris</Chip>
          )}
          {CATEGORIES_ORDER.map((c) => (
            <Chip key={c} active={filter === c} onClick={() => setFilter(c)}>
              {CATEGORY_GLYPHS[c]} {CATEGORY_LABELS[c]}
            </Chip>
          ))}
        </div>

        <motion.ul layout className="grid grid-cols-2 gap-3 md:grid-cols-3" aria-label="Jeux">
          <AnimatePresence mode="popLayout">
            {gamesToShow.map((g, i) => (
              <GameCard
                key={g.type}
                game={g}
                index={i}
                isFav={favorites.includes(g.type)}
                onFav={() => toggleFav(g.type)}
                onOpen={() => setSelected(g)}
              />
            ))}
          </AnimatePresence>
        </motion.ul>

        {!filter && filtered.length > PREVIEW_COUNT && (
          <button onClick={() => setShowAllGames((s) => !s)} className="btn-ghost mt-4 w-full py-2.5 text-sm">
            {showAllGames ? "Voir moins" : `Voir les ${filtered.length} jeux`}
          </button>
        )}
      </section>

      {/* ---- Historique ---- */}
      {history.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-xl font-black text-paper">Vos dernières parties</h2>
          <div className="flex flex-col gap-2">
            {history.slice(0, 8).map((h) => {
              const g = GAME_CATALOG.find((x) => x.type === h.gameType);
              const others = h.players.map((p) => p.displayName).join(" & ");
              return (
                <div key={h.id} className="card flex items-center gap-3 px-4 py-3">
                  <span className="text-2xl">{g?.glyph ?? CATEGORY_GLYPHS[h.category] ?? "🎲"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-paper">{g?.name ?? h.gameType.replace(/_/g, " ")}</p>
                    <p className="truncate text-xs text-sand">
                      {others} · {new Date(h.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} ·{" "}
                      {STATUS_LABELS[h.status] ?? h.status}
                    </p>
                  </div>
                  {h.result ? (
                    <span className="rounded-lg bg-saffron/15 px-2 py-1 font-display text-sm font-bold text-saffron">
                      {h.result.coupleScorePct}%
                    </span>
                  ) : (
                    g && (
                      <button onClick={() => setSelected(g)} className="text-xs text-saffron hover:underline">
                        Rejouer
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      </main>

      <footer className="mt-auto flex flex-col items-center gap-3 pt-12 text-center">
        <AccentPicker />
        <nav aria-label="Informations">
          <Link to="/confidentialite" className="inline-flex min-h-11 items-center px-3 text-sm text-sand underline-offset-4 hover:text-paper hover:underline">
            Confidentialité & données
          </Link>
        </nav>
        <p className="text-xs uppercase tracking-[0.2em] text-mute">
          NIO FAR · fait avec <span aria-label="amour">❤️</span> à Dakar · © {new Date().getFullYear()}
        </p>
      </footer>

      <GameSheet
        game={selected}
        difficulty={difficulty}
        onDifficulty={setDifficulty}
        busy={busy}
        hasName={!!name.trim()}
        onClose={() => setSelected(null)}
        onPlay={(g) => handlePlay(g.type, difficulty)}
      />
    </div>
  );
}

/** « Un clic, une couleur » : change l'accent de toute l'app. */
function AccentPicker() {
  const [current, setCurrent] = useState(savedAccent);
  return (
    <div className="glass flex items-center gap-0.5 rounded-full py-0.5 pl-4 pr-1" role="radiogroup" aria-label="Couleur de l'app">
      <span aria-hidden className="mr-1 text-xs uppercase tracking-widest text-mute">Couleur</span>
      {ACCENTS.map((a) => (
        <button
          key={a.id}
          role="radio"
          aria-checked={current === a.id}
          aria-label={a.label}
          title={a.label}
          onClick={() => setCurrent(applyAccent(a.id))}
          className="flex h-11 w-11 items-center justify-center rounded-full"
        >
          <span
            aria-hidden
            className={`h-6 w-6 rounded-full transition ${current === a.id ? "ring-2 ring-white ring-offset-2 ring-offset-ink" : "opacity-70 hover:opacity-100"}`}
            style={{ background: `linear-gradient(135deg, rgb(${a.acc}), rgb(${a.second}))` }}
          />
        </button>
      ))}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition ${
        active ? "border-saffron bg-saffron/15 text-saffron" : "border-line bg-ink2/60 text-sand hover:border-clay/50 hover:text-paper"
      }`}
    >
      {children}
    </button>
  );
}

function GameCard({
  game: g,
  index,
  isFav,
  onFav,
  onOpen,
}: {
  game: GameCatalogEntry;
  index: number;
  isFav: boolean;
  onFav: () => void;
  onOpen: () => void;
}) {
  const accent = CATEGORY_ACCENTS[g.category];
  const titleId = `game-${g.type}`;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 16, rotateX: 18, filter: "blur(12px)" }}
      animate={{ opacity: 1, y: 0, rotateX: 0, filter: "blur(0px)", transition: { delay: Math.min(index, 10) * 0.04, duration: 0.55, ease: [0.22, 1, 0.36, 1] } }}
      exit={{ opacity: 0, scale: 0.95 }}
      style={{ transformPerspective: 900 }}
      className="card group relative flex flex-col gap-2 overflow-hidden p-4 transition hover:-translate-y-0.5 hover:shadow-lift focus-within:ring-2 focus-within:ring-clay/70"
    >
      <div aria-hidden className={`pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${accent.glow} to-transparent opacity-70`} />
      <span aria-hidden className="relative text-3xl drop-shadow">{g.glyph}</span>
      <h3 id={titleId} className="relative font-display text-base font-semibold leading-snug text-paper">
        {/* le bouton couvre toute la carte (::after) : une seule cible, nom = texte visible */}
        <button onClick={onOpen} className="text-left outline-none after:absolute after:inset-0 after:rounded-3xl after:content-['']">
          {g.name}
        </button>
      </h3>
      <p className="relative line-clamp-2 text-xs leading-snug text-sand">{g.tagline}</p>
      <div className="relative mt-auto flex flex-wrap items-center gap-1.5 pt-1">
        <span className={`text-xs font-semibold uppercase tracking-wider ${accent.text}`}>{CATEGORY_LABELS[g.category]}</span>
        {g.isNew && <span className="rounded-full bg-[rgb(var(--btn-1))] px-2 py-0.5 text-xs font-bold text-white">Nouveau</span>}
        {g.timerSeconds && <span className="text-xs text-mute">⏱️ {g.timerSeconds} s</span>}
      </div>
      <button
        onClick={onFav}
        className="absolute right-1.5 top-1.5 z-10 flex h-11 w-11 items-center justify-center rounded-full text-lg transition hover:scale-110 hover:bg-white/10"
        aria-label={isFav ? `Retirer ${g.name} des favoris` : `Ajouter ${g.name} aux favoris`}
        aria-pressed={isFav}
      >
        <span aria-hidden>{isFav ? "❤️" : "🤍"}</span>
      </button>
    </motion.li>
  );
}

function GameSheet({
  game,
  difficulty,
  onDifficulty,
  busy,
  hasName,
  onClose,
  onPlay,
}: {
  game: GameCatalogEntry | null;
  difficulty: Difficulty;
  onDifficulty: (d: Difficulty) => void;
  busy: boolean;
  hasName: boolean;
  onClose: () => void;
  onPlay: (g: GameCatalogEntry) => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [adult, setAdult] = useState(() => localStorage.getItem("niofar_adult") === "1");
  const needsAdult = !!game && (difficulty === "INTENSE" || game.category === "FLIRT");
  const blocked = needsAdult && !adult;

  // Dialogue modal accessible : Échap ferme, Tab reste dans la fiche,
  // le focus va sur le titre à l'ouverture et revient au bouton d'origine.
  useEffect(() => {
    if (!game) return;
    const opener = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => sheetRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !sheetRef.current) return;
      const items = [...sheetRef.current.querySelectorAll<HTMLElement>("button, input, [href], [tabindex]:not([tabindex='-1'])")].filter((el) => !el.hasAttribute("disabled"));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [game, onClose]);

  return (
    <AnimatePresence>
      {game && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sheet-title"
            className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md rounded-t-[2rem] border border-b-0 border-line bg-ink2 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-lift md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:rounded-[2rem] md:border-b"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => info.offset.y > 120 && onClose()}
          >
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-line md:hidden" />
            <div className="flex items-start gap-4">
              <span aria-hidden className="text-5xl">{game.glyph}</span>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${CATEGORY_ACCENTS[game.category].text}`}>
                  {CATEGORY_GLYPHS[game.category]} {CATEGORY_LABELS[game.category]}
                </p>
                <h2 id="sheet-title" tabIndex={-1} data-autofocus className="font-display text-2xl font-bold leading-tight text-paper outline-none">
                  {game.name}
                </h2>
              </div>
              <button onClick={onClose} className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-mute hover:bg-white/10 hover:text-paper" aria-label="Fermer la fiche">
                <span aria-hidden>✕</span>
              </button>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-sand">{game.description}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-widest text-mute">
              <span className="rounded-full border border-line px-2.5 py-1">{game.family === "TURN_BASED" ? "Chacun son tour" : "Réponses simultanées"}</span>
              {game.timerSeconds && <span className="rounded-full border border-line px-2.5 py-1">⏱️ {game.timerSeconds} s</span>}
              {game.scoringEnabled && <span className="rounded-full border border-line px-2.5 py-1">Points</span>}
            </div>

            <p id="niveau-label" className="eyebrow mt-6 mb-2">Niveau</p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="niveau-label">
              {(["SOFT", "NORMAL", "INTENSE"] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => onDifficulty(d)}
                  role="radio"
                  aria-checked={difficulty === d}
                  className={`flex flex-col items-center gap-0.5 rounded-2xl border px-2 py-2.5 text-center transition ${
                    difficulty === d ? "border-saffron bg-saffron/15 text-saffron" : "border-line bg-ink/40 text-sand hover:border-clay/40"
                  }`}
                >
                  <span className="text-sm font-semibold">
                    <span aria-hidden>{DIFFICULTY_GLYPHS[d]}</span> {DIFFICULTY_LABELS[d]}
                  </span>
                  <span className="text-xs text-mute">≤ {game.rounds[d]} manches</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-center text-xs italic text-mute">{DIFFICULTY_HINTS[difficulty]}</p>

            {needsAdult && (
              <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-sand">
                <input
                  type="checkbox"
                  checked={adult}
                  onChange={(e) => {
                    setAdult(e.target.checked);
                    if (e.target.checked) localStorage.setItem("niofar_adult", "1");
                    else localStorage.removeItem("niofar_adult");
                  }}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--acc))]"
                />
                <span>
                  <strong className="text-paper">Je confirme avoir 18 ans ou plus.</strong> Ce contenu est réservé aux adultes.
                </span>
              </label>
            )}

            <button onClick={() => onPlay(game)} disabled={busy || blocked} className="btn-clay mt-5 w-full py-4 text-lg">
              {busy ? "Création…" : hasName ? "Créer la partie" : "Entre d'abord ton prénom"}
            </button>
            <p className="mt-2 text-center text-xs text-mute">Tu recevras un lien à envoyer à ton/ta partenaire.</p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
