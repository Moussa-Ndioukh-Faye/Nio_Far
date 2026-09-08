export type GameType =
  | "GUESS_ME"
  | "GUESS_MY_ANSWER"
  | "WHO_KNOWS_BEST"
  | "TRUTH_OR_DARE"
  | "TRUTH"
  | "DARE"
  | "WHO_IS_MORE"
  | "WOULD_YOU_RATHER"
  | "NO_YES_NO"
  | "MIME_PARTNER"
  | "COMPLIMENT_CHALLENGE"
  | "OUR_MEMORIES"
  | "COMPLETE_THE_SENTENCE"
  | "FIVE_THINGS"
  | "DEEP_QUESTIONS"
  | "OUR_DREAMS"
  | "OUR_FUTURE"
  | "OUR_VALUES"
  | "FLIRT_QUESTIONS"
  | "SEDUCTION_CHALLENGES"
  | "IMPOSSIBLE_CHOICE"
  | "COUPLE_BATTLE"
  | "TIMED_QUIZ"
  | "SPEED_DUEL";

export type Category =
  | "CONNAISSANCE"
  | "ACTION_VERITE"
  | "FUN"
  | "ROMANTIC"
  | "PROFOND"
  | "FLIRT"
  | "COMPETITION";

export type Difficulty = "SOFT" | "NORMAL" | "INTENSE";
export type GameFamily = "STANDARD" | "TURN_BASED";

export type SessionStatus = "WAITING" | "READY" | "PLAYING" | "REVEALING" | "FINISHED" | "ABANDONED";

export interface PlayerState {
  id: string;
  displayName: string;
  socketId: string | null;
  isConnected: boolean;
  isReady: boolean;
  score: number;
}

export interface GameMeta {
  roomId: string;
  code: string;
  gameType: GameType;
  category: Category;
  difficulty: Difficulty;
  gameName: string;
  family: GameFamily;
  scoringEnabled: boolean;
  totalRounds: number;
  currentRound: number;
  turnPlayerId: string | null;
  hostId: string;
  players: PlayerState[];
  status: SessionStatus;
  scores: Record<string, number>;
  createdAt: number;
}

// ---- Vues ----

export interface StandardQuestion {
  cardId: string;
  prompt: string;
  options: string[];
  index: number;
}

export interface StandardReveal {
  answers: Record<string, string>;
  isMatch: boolean;
  scoreDelta: Record<string, number>;
}

export interface StandardView {
  kind: "STANDARD";
  round: number;
  totalRounds: number;
  phase: "QUESTION" | "REVEAL";
  question: StandardQuestion | null;
  answeredPlayerIds: string[];
  reveal: StandardReveal | null;
}

export interface TurnCard {
  type: string;
  content: string;
}

export interface TurnBasedView {
  kind: "TURN_BASED";
  round: number;
  totalRounds: number;
  turnPlayerId: string | null;
  phase: "CHOOSE" | "CARD" | "RESOLVED";
  options: string[];
  choseType: string | null;
  card: TurnCard | null;
  resolution: { result: "DONE" | "PASS"; byPlayerId: string } | null;
  status: string;
}

export interface FinishedResult {
  coupleScorePct: number;
  player1Score: number;
  player2Score: number;
  matchingAnswers: number;
  differentAnswers: number;
  totalAnswers: number;
  bestStreak: number;
  summaryLabel: string;
}

export interface FinishedView {
  kind: "FINISHED";
  result: FinishedResult;
}

export type GameView = StandardView | TurnBasedView | FinishedView | null;

export interface SessionPublicState {
  meta: GameMeta;
  view: GameView;
}

export interface ChatMessage {
  playerId: string;
  text: string;
  createdAt: number;
}

// ---- Catalogue ----

export interface GameCatalogEntry {
  type: GameType;
  name: string;
  category: Category;
  tagline: string;
  description: string;
  glyph: string;
  family: GameFamily;
  scoringEnabled: boolean;
  rounds: Record<Difficulty, number>;
}

// ---- Historique ----

export interface HistoryEntry {
  id: string;
  code: string;
  gameType: GameType;
  category: Category;
  difficulty: Difficulty;
  scoringEnabled: boolean;
  totalRounds: number;
  status: SessionStatus;
  createdAt: string;
  players: { id: string; displayName: string; score: number }[];
  result: { coupleScorePct: number; matchingAnswers: number; differentAnswers: number } | null;
}