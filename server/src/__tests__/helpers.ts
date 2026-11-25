import { GameEngine } from "../game-engine/GameEngine";
import { DeckCard } from "../game-engine/rules";
import { createRules } from "../game-engine/rules/index";
import { GameFamily, GameType } from "../types";

export function deckOf(n: number, opts: Partial<DeckCard> = {}): DeckCard[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    type: "QUESTION",
    content: `Question ${i}`,
    options: ["A", "B", "C"],
    ...opts,
  }));
}

/** Room à 2 joueurs prête à jouer (A = hôte, B = partenaire). */
export function makeEngine(params: {
  family?: GameFamily;
  deck?: DeckCard[];
  cardTypes?: string[];
  totalRounds?: number;
  scoringEnabled?: boolean;
  timerSeconds?: number | null;
  speedBonus?: boolean;
  gameType?: GameType;
  start?: boolean;
}) {
  const family = params.family ?? "STANDARD";
  const engine = new GameEngine({
    roomId: "room_NF-TEST",
    code: "NF-TEST",
    gameType: params.gameType ?? "GUESS_ME",
    category: "CONNAISSANCE",
    difficulty: "SOFT",
    gameName: "Test",
    family,
    scoringEnabled: params.scoringEnabled ?? true,
    totalRounds: params.totalRounds ?? 5,
    hostId: "A",
    deck: params.deck ?? deckOf(10),
    buildRules: createRules(family, params.cardTypes ?? ["QUESTION"], {
      timerSeconds: params.timerSeconds ?? null,
      speedBonus: params.speedBonus ?? false,
    }),
    timerSeconds: params.timerSeconds ?? null,
  });
  engine.addPlayer({ id: "A", displayName: "Moussa", socketId: "sA" });
  engine.addPlayer({ id: "B", displayName: "Awa", socketId: "sB" });
  if (params.start !== false) {
    engine.setPlayerReady("A", true);
    engine.setPlayerReady("B", true);
    const res = engine.start();
    if (!res.ok) throw new Error(`start failed: ${res.error}`);
  }
  return engine;
}
