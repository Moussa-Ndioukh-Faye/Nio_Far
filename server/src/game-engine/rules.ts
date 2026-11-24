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

// Ce que le moteur expose aux rulesets : joueurs, scores, métadonnées, horloge.
export interface RulesetHost {
  readonly players: PlayerState[];
  readonly scores: Record<string, number>;
  readonly scoringEnabled: boolean;
  readonly totalRounds: number;
  readonly gameType: GameType;
  round: number;
  turnPlayerId: string | null;
  addScore(playerId: string, delta: number): void;
  /** horloge injectable (Date.now en prod, horloge factice en test) */
  now(): number;
}

/** Options de règles issues du catalogue. */
export interface RulesOptions {
  /** secondes par question (jeux chronométrés) */
  timerSeconds?: number | null;
  /** bonus au plus rapide quand les réponses concordent */
  speedBonus?: boolean;
}

// Un ruleset = les règles pures d'une famille de jeux (standard / tour par tour).
// Il ne connaît ni Socket.IO ni Prisma ; il s'exprime via act/next/getView.
// Il ne programme aucun timer lui-même : il expose une échéance (getDeadline)
// et le moteur appelle onTimeout() quand elle est atteinte.
export interface Ruleset {
  readonly family: GameFamily;
  loadDeck(deck: DeckCard[]): void;
  start(): ActionResult;
  act(playerId: string, action: string, payload: unknown): ActionResult;
  next(playerId: string): ActionResult;
  getView(): GameView;
  isFinished(): boolean;
  getFinalResult(): RoomResultSummary;
  getDeadline(): number | null;
  onTimeout(): ActionResult;
}

/** Phrase de verdict selon le pourcentage de complicité / réussite. */
export function verdictFor(pct: number, total: number): string {
  if (total === 0) return "Partie express — rejouez pour vous découvrir 😉";
  if (pct >= 90) return "Âmes sœurs certifiées 💞";
  if (pct >= 70) return "Sur la même longueur d'onde 🎶";
  if (pct >= 50) return "Belle complicité, encore des choses à découvrir ✨";
  if (pct >= 30) return "Vous avez de quoi parler ce soir 😄";
  return "Opposés qui s'attirent ? Une revanche s'impose 🔥";
}
