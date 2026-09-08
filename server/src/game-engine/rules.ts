import { GameFamily, GameType, GameView, PlayerState, RoomResultSummary } from "../types";

// Carte de contenu servie au moteur (miroir d'un GameCard). L'id est
// l'id prisma pour pouvoir tracer via questionOrder / Answer.
export interface DeckCard {
  id: string;
  type: string;
  content: string;
  options: string[];
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// Ce que le moteur expose aux rulesets : joueurs, scores et métadonnées.
export interface RulesetHost {
  readonly players: PlayerState[];
  readonly scores: Record<string, number>;
  readonly scoringEnabled: boolean;
  readonly totalRounds: number;
  readonly gameType: GameType;
  round: number;
  turnPlayerId: string | null;
  addScore(playerId: string, delta: number): void;
}

// Un ruleset = les règles pures d'une famille de jeux (standard / tour par tour).
// Il ne connaît ni Socket.IO ni Prisma ; il s'exprime via act/next/getView.
export interface Ruleset {
  readonly family: GameFamily;
  loadDeck(deck: DeckCard[]): void;
  start(): ActionResult;
  act(playerId: string, action: string, payload: unknown): ActionResult;
  next(playerId: string): ActionResult;
  getView(): GameView;
  isFinished(): boolean;
  getFinalResult(): RoomResultSummary;
}