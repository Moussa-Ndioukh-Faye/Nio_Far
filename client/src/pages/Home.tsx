import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../contexts/GameContext";

export function Home() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [gameType, setGameType] = useState("GUESS_ME");
  const [error, setError] = useState<string | null>(null);
  const { createRoom, joinRoom } = useGame();
  const navigate = useNavigate();

  async function handleCreate() {
    if (!name.trim()) return setError("Choisis ton prénom d'abord.");
    const res = await createRoom(name.trim(), gameType);
    if (!res) return setError("Impossible de créer la partie, réessaie.");
    navigate(`/room/${res.code}`);
  }

  async function handleJoin() {
    if (!name.trim() || !code.trim()) return setError("Prénom et code requis.");
    const ok = await joinRoom(name.trim(), code.trim().toUpperCase());
    if (!ok) return setError("Code invalide ou partie déjà complète.");
    navigate(`/room/${code.trim().toUpperCase()}`);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-center text-3xl font-bold text-blush">NIO FAR ❤️</h1>
      <p className="text-center text-neutral-400">Jouez. Découvrez-vous. Rapprochez-vous.</p>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-neutral-400">Comment veux-tu apparaître ?</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="❤️ Moussa"
          className="rounded-xl bg-neutral-900 px-4 py-3 outline-none ring-blush focus:ring-2"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-neutral-400">Choisis un jeu</label>
        <select
          value={gameType}
          onChange={(e) => setGameType(e.target.value)}
          className="rounded-xl bg-neutral-900 px-4 py-3 outline-none"
        >
          <option value="GUESS_ME">À quel point tu me connais ?</option>
          <option value="COUPLE_BATTLE">Couple Battle</option>
          <option value="TRUTH_OR_DARE">Vérité ou Défi</option>
        </select>
      </div>

      <button onClick={handleCreate} className="rounded-xl bg-blush px-4 py-3 font-semibold text-white hover:bg-blushDark">
        Créer une partie ❤️
      </button>

      <div className="flex items-center gap-3 text-neutral-500">
        <div className="h-px flex-1 bg-neutral-800" />
        ou rejoindre
        <div className="h-px flex-1 bg-neutral-800" />
      </div>

      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code NF-XXXX"
          className="flex-1 rounded-xl bg-neutral-900 px-4 py-3 outline-none"
        />
        <button onClick={handleJoin} className="rounded-xl border border-neutral-700 px-4 py-3 font-medium hover:bg-neutral-800">
          Rejoindre
        </button>
      </div>

      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}
