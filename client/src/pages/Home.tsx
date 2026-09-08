import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mark } from "../components/Mark";
import { useGame } from "../contexts/GameContext";
import {
  GAME_CATALOG,
  CATEGORIES_ORDER,
  CATEGORY_LABELS,
  CATEGORY_GLYPHS,
  DIFFICULTY_LABELS,
  DIFFICULTY_GLYPHS,
  getFavorites,
  toggleFavorite,
} from "../data/catalog";
import { Category, Difficulty, HistoryEntry } from "../types";

const NAME_KEY = "niofar_name";

export function Home() {
  const navigate = useNavigate();
  const { createRoom, joinRoom, deviceId } = useGame();

  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? "");
  const [category, setCategory] = useState<Category | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("SOFT");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => getFavorites());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showAllGames, setShowAllGames] = useState(false);

  const filtered = useMemo(
    () => (category ? GAME_CATALOG.filter((g) => g.category === category) : GAME_CATALOG),
    [category]
  );

  const favGames = useMemo(() => GAME_CATALOG.filter((g) => favorites.includes(g.type)), [favorites]);

  useEffect(() => {
    localStorage.setItem(NAME_KEY, name);
  }, [name]);

  useEffect(() => {
    fetch(`/api/me/history?deviceId=${encodeURIComponent(deviceId)}`)
      .then((r) => (r.ok ? r.json() : { history: [] }))
      .then((data) => setHistory(Array.isArray(data) ? data : (data?.history ?? [])))
      .catch(() => {});
  }, [deviceId]);

  const gamesToShow = showAllGames ? filtered : filtered.slice(0, 8);

  async function handlePlay(gameType: string, difficulty: Difficulty) {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await createRoom(name.trim(), gameType as any, difficulty);
      if (res) navigate(`/room/${res.code}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!name.trim() || !joinCode.trim()) return;
    setBusy(true);
    try {
      const ok = await joinRoom(name.trim(), joinCode.trim().toUpperCase());
      if (ok) navigate(`/room/${joinCode.trim().toUpperCase()}`);
    } finally {
      setBusy(false);
    }
  }

  function toggleFav(type: string) {
    setFavorites(toggleFavorite(type));
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6">

      {/* ---- Hero ---- */}
      <header className="mb-8 flex flex-col items-center gap-4 text-center">
        <Mark size={64} />
        <div>
          <h1 className="font-display text-4xl font-black text-paper">
            NIO <span className="italic text-clay">FAR</span>
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.26em] text-mute">
            Le jeu qui rapproche les cœurs
          </p>
        </div>
      </header>

      {/* ---- Name ---- */}
      <div className="mb-6 flex flex-col gap-2">
        <label className="eyebrow">Ton prénom</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Prénom"
          className="field"
          maxLength={24}
        />
      </div>

      {/* ---- Difficulté ---- */}
      <div className="mb-6 flex flex-col gap-2">
        <label className="eyebrow">Niveau</label>
        <div className="flex gap-2">
          {(["SOFT", "NORMAL", "INTENSE"] as Difficulty[]).map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`flex-1 rounded-xl border px-3 py-2.5 text-center text-sm font-semibold transition ${
                difficulty === d
                  ? "border-saffron bg-saffron/15 text-saffron"
                  : "border-line bg-ink/40 text-mute hover:border-clay/40 hover:text-sand"
              }`}
            >
              <span className="mr-1">{DIFFICULTY_GLYPHS[d]}</span> {DIFFICULTY_LABELS[d]}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Catégories ---- */}
      <div className="mb-4 flex flex-col gap-2">
        <label className="eyebrow">Catégorie</label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategory(null)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              category === null
                ? "border-saffron bg-saffron/15 text-saffron"
                : "border-line bg-ink/40 text-mute hover:border-clay/40"
            }`}
          >
            Tous
          </button>
          {CATEGORIES_ORDER.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                category === c
                  ? "border-saffron bg-saffron/15 text-saffron"
                  : "border-line bg-ink/40 text-mute hover:border-clay/40"
              }`}
            >
              {CATEGORY_GLYPHS[c]} {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Grille jeux ---- */}
      <div className="mb-3 flex items-center justify-between">
        <span className="eyebrow">{category ? CATEGORY_LABELS[category] : "Tous les jeux"}</span>
        {filtered.length > 8 && (
          <button onClick={() => setShowAllGames(!showAllGames)} className="text-xs text-saffron hover:underline">
            {showAllGames ? "Voir moins" : `Voir les ${filtered.length}`}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 mb-8">
        {gamesToShow.map((g) => {
          const isFav = favorites.includes(g.type);
          return (
            <div key={g.type} className="card flex flex-col gap-2.5 p-4">
              <div className="flex items-start justify-between">
                <span className="text-3xl">{g.glyph}</span>
                <button
                  onClick={() => toggleFav(g.type)}
                  className="text-lg transition hover:scale-110"
                  aria-label={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
                >
                  {isFav ? "❤️" : "🤍"}
                </button>
              </div>
              <h3 className="font-display text-sm font-bold leading-snug text-paper">{g.name}</h3>
              <p className="text-[0.65rem] leading-snug text-sand">{g.tagline}</p>
              <span className="text-[0.6rem] uppercase tracking-widest text-mute">{CATEGORY_LABELS[g.category]}</span>
              <button
                onClick={() => handlePlay(g.type, difficulty)}
                disabled={busy || !name.trim()}
                className="btn-clay w-full py-2 text-xs"
              >
                Jouer
              </button>
            </div>
          );
        })}
      </div>

      {/* ---- Mes jeux favoris ---- */}
      {favGames.length > 0 && (
        <section className="mb-8">
          <h2 className="eyebrow mb-3">Mes jeux ❤️</h2>
          <div className="flex flex-col gap-2">
            {favGames.map((g) => (
              <div key={g.type} className="card flex items-center gap-3 px-4 py-3">
                <span className="text-2xl">{g.glyph}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-paper">{g.name}</p>
                  <p className="truncate text-[0.65rem] text-sand">{g.tagline}</p>
                </div>
                <button
                  onClick={() => handlePlay(g.type, difficulty)}
                  disabled={busy || !name.trim()}
                  className="btn-clay shrink-0 px-3 py-1.5 text-xs"
                >
                  Jouer
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---- Historique ---- */}
      {history.length > 0 && (
        <section className="mb-8">
          <h2 className="eyebrow mb-3">Historique</h2>
          <div className="flex flex-col gap-2">
            {history.slice(0, 10).map((h) => {
              const cat = CATEGORY_GLYPHS[h.category] ?? "🎲";
              return (
                <div key={h.id} className="card flex items-center gap-3 px-4 py-3">
                  <span className="text-xl">{cat}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-paper">
                      {h.gameType.replace(/_/g, " ")}
                    </p>
                    <p className="text-[0.65rem] text-sand">
                      {new Date(h.createdAt).toLocaleDateString("fr-FR")} · {h.status}
                    </p>
                  </div>
                  {h.result && (
                    <span className="rounded-lg bg-saffron/15 px-2 py-1 text-xs font-bold text-saffron">
                      {h.result.coupleScorePct}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ---- Rejoindre ---- */}
      <section className="mb-8 flex flex-col gap-3">
        <h2 className="eyebrow">Rejoindre une partie</h2>
        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Code de la partie"
            className="field flex-1"
            maxLength={6}
          />
          <button
            onClick={handleJoin}
            disabled={busy || !name.trim() || !joinCode.trim()}
            className="btn-clay shrink-0 px-5 py-3"
          >
            Rejoindre
          </button>
        </div>
      </section>

      {/* ---- Footer ---- */}
      <footer className="mt-auto border-t border-line pt-6 pb-4 text-center text-[0.65rem] uppercase tracking-[0.22em] text-mute">
        NIO FAR © {new Date().getFullYear()}
      </footer>
    </div>
  );
}