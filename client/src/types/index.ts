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
  | "SPEED_DUEL"
  | "COUPLE_QUESTIONS";

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
  socketId?: string | null;
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
  /** joueurs ayant demandé une revanche (écran de fin) */
  rematchVotes: string[];
  /** nombre de parties enchaînées dans cette room (revanches comprises) */
  gamesPlayed: number;
  /** secondes par question si le jeu est chronométré, sinon null */
  timerSeconds: number | null;
}

// ---- Vues par règles de jeu (le client rend exactement cette vue) ----

export interface StandardQuestion {
  cardId: string;
  prompt: string;
  options: string[];
  index: number;
}

export interface StandardReveal {
  /** réponses brutes (option cliquée) */
  answers: Record<string, string>;
  /** réponses lisibles : « MOI » / « MON PARTENAIRE » remplacés par le prénom visé */
  display: Record<string, string>;
  isMatch: boolean;
  scoreDelta: Record<string, number>;
  /** joueurs qui n'ont pas répondu à temps */
  timedOut: string[];
  /** joueur le plus rapide (jeux chronométrés, si les deux ont répondu) */
  fastestPlayerId: string | null;
}

export interface StandardView {
  kind: "STANDARD";
  round: number;
  totalRounds: number;
  phase: "QUESTION" | "REVEAL";
  question: StandardQuestion | null;
  answeredPlayerIds: string[];
  reveal: StandardReveal | null;
  /** horodatage serveur (ms) de fin de la question chronométrée, sinon null */
  deadline: number | null;
}

export interface TurnCard {
  type: string;
  content: string;
}

export type TurnResult = "DONE" | "PASS" | "REJECTED";

export interface TurnBasedView {
  kind: "TURN_BASED";
  round: number;
  totalRounds: number;
  turnPlayerId: string | null;
  /** le partenaire qui valide (ou non) la carte du tour */
  judgePlayerId: string | null;
  phase: "CHOOSE" | "CARD" | "JUDGE" | "RESOLVED";
  options: string[];
  choseType: string | null;
  card: TurnCard | null;
  /** réponse écrite du joueur dont c'est le tour (vérités / questions) */
  submission: { text: string | null } | null;
  resolution: { result: TurnResult; byPlayerId: string } | null;
  status: string;
}

export interface RoundRecap {
  round: number;
  prompt: string;
  type?: string;
  /** STANDARD : réponses lisibles par joueur */
  answers?: Record<string, string>;
  isMatch?: boolean;
  /** TURN_BASED : joueur du tour, résultat et réponse écrite */
  byPlayerId?: string;
  result?: TurnResult;
  text?: string | null;
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
  /** petite phrase de verdict selon le score de complicité */
  verdict: string;
  rounds: RoundRecap[];
}

export interface FinishedView {
  kind: "FINISHED";
  result: FinishedResult;
}

export type GameView = StandardView | TurnBasedView | FinishedView | null;

export interface SessionPublicState {
  meta: GameMeta;
  view: GameView;
  /** horloge serveur au moment de l'envoi, pour caler les chronos côté client */
  serverNow: number;
}

export interface ChatMessage {
  id: string;
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
  /** secondes par question si chronométré */
  timerSeconds?: number;
  /** badge « Nouveau » sur l'accueil */
  isNew?: boolean;
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