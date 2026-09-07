import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useGame } from "../contexts/GameContext";
import { Mark } from "../components/Mark";

const GAME_TYPES: { id: string; label: string; tagline: string; glyph: React.ReactNode }[] = [
  {
    id: "GUESS_ME",
    label: "Tu me connais ?",
    tagline: "Devine ce que l'autre choisira",
    glyph: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="10" cy="12" r="6" />
        <path d="M21 3l-4.5 4.5M16.5 3H21v4.5" />
      </svg>
    ),
  },
  {
    id: "COUPLE_BATTLE",
    label: "Couple Battle",
    tagline: "Moi ou mon partenaire ?",
    glyph: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="9" r="5" />
        <circle cx="15" cy="15" r="5" />
      </svg>
    ),
  },
  {
    id: "TRUTH_OR_DARE",
    label: "Vérité ou Défi",
    tagline: "Oserez-vous ?",
    glyph: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 3v12M6 9h12" />
      </svg>
    ),
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

export function Home() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [gameType, setGameType] = useState("GUESS_ME");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { createRoom, joinRoom } = useGame();
  const navigate = useNavigate();

  async function handleCreate() {
    if (!name.trim()) return setError("Choisis un prénom d'abord.");
    setBusy(true);
    const res = await createRoom(name.trim(), gameType);
    if (!res) {
      setError("Impossible de créer la partie, réessaie.");
      setBusy(false);
      return;
    }
    navigate(`/room/${res.code}`);
  }

  async function handleJoin() {
    if (!name.trim() || !code.trim()) return setError("Prénom et code requis.");
    setBusy(true);
    const ok = await joinRoom(name.trim(), code.trim().toUpperCase().replace(/^NF-?/, "NF-"));
    if (!ok) {
      setError("Code invalide ou partie déjà complète.");
      setBusy(false);
      return;
    }
    navigate(`/room/${code.trim().toUpperCase()}`);
  }

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-7">
        <motion.header variants={item} className="flex flex-col items-center gap-4 text-center">
          <div className="relative">
            <Mark size={64} className="animate-float drop-shadow-[0_10px_30px_rgba(199,75,47,0.45)]" />
            <span className="absolute inset-0 -z-10 animate-spin-slow rounded-full border border-dashed border-saffron/25" />
          </div>
          <div>
            <p className="eyebrow mb-1">Jouez · Découvrez-vous · Rapprochez-vous</p>
            <h1 className="font-display text-5xl font-black tracking-tight text-paper">
              NIO <span className="italic text-clay">FAR</span>
            </h1>
          </div>
          <p className="max-w-[16rem] font-display text-base italic leading-snug text-sand">
            Pour deux cœurs à distance qui veulent se retrouver.
          </p>
        </motion.header>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            role="alert"
            className="rounded-xl border border-bissap/40 bg-bissap/10 px-4 py-3 text-center text-sm text-bissap"
          >
            {error}
          </motion.p>
        )}

        <motion.section variants={item} className="flex flex-col gap-2">
          <label htmlFor="name" className="eyebrow">Comment veux-tu apparaître ?</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ton prénom…"
            maxLength={30}
            className="field"
          />
        </motion.section>

        <motion.section variants={item} className="flex flex-col gap-2">
          <span className="eyebrow">Choisis un jeu</span>
          <div className="flex flex-col gap-2.5">
            {GAME_TYPES.map((g) => {
              const active = gameType === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setGameType(g.id)}
                  aria-pressed={active}
                  className={`card group flex items-center gap-4 px-4 py-3.5 text-left transition duration-200 ${
                    active ? "border-clay/70 shadow-glowClay" : "hover:border-saffron/30 hover:bg-ink3"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition duration-200 ${
                      active ? "bg-clay text-paper" : "bg-ink3 text-sand group-hover:text-paper"
                    }`}
                  >
                    {g.glyph}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-sm font-semibold ${active ? "text-paper" : "text-sand"}`}>{g.label}</span>
                    <span className="block text-xs text-mute">{g.tagline}</span>
                  </span>
                  <span
                    className={`ml-auto h-4 w-4 shrink-0 rounded-full border-2 transition duration-200 ${
                      active ? "border-saffron bg-saffron" : "border-line"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </motion.section>

        <motion.button
          variants={item}
          onClick={handleCreate}
          disabled={busy}
          className="btn-clay w-full py-4 text-lg"
        >
          {busy ? "Création…" : "Créer la partie"}
        </motion.button>

        <motion.div variants={item} className="flex items-center gap-4 text-sand">
          <div className="h-px flex-1 bg-line" />
          <span className="font-display italic text-mute">ou rejoindre</span>
          <div className="h-px flex-1 bg-line" />
        </motion.div>

        <motion.div
          variants={item}
          className="card flex items-stretch gap-2 p-2.5"
        >
          <span className="flex items-center pl-3 font-display text-lg font-bold tracking-widest text-saffron">NF</span>
          <div className="h-8 w-px self-center bg-line" />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            placeholder="XXXX"
            maxLength={10}
            className="w-full bg-transparent px-3 font-display text-lg font-semibold uppercase tracking-[0.2em] text-paper outline-none placeholder:text-mute placeholder:font-sans placeholder:font-normal placeholder:tracking-normal"
          />
          <button onClick={handleJoin} disabled={busy} className="btn btn-clay shrink-0 px-5">
            Rejoindre
          </button>
        </motion.div>

        <motion.footer variants={item} className="pb-2 text-center">
          <p className="text-xs text-mute">La partie démarre quand vous êtes deux, prêts à tout se dire.</p>
        </motion.footer>
      </motion.div>
    </div>
  );
}