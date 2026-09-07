export type GameType = "GUESS_ME" | "COUPLE_BATTLE" | "TRUTH_OR_DARE";

export type SessionStatus =
  | "WAITING"
  | "READY"
  | "PLAYING"
  | "REVEALING"
  | "FINISHED"
  | "ABANDONED";

export interface PlayerState {
  id: string;
  displayName: string;
  socketId: string | null;
  isConnected: boolean;
  isReady: boolean;
  score: number;
}

export interface QuestionPayload {
  id: string;
  prompt: string;
  options: string[];
  index: number;
  total: number;
}

export interface AnswerRecord {
  playerId: string;
  value: string;
  submittedAt: number;
}

export interface RoomState {
  roomId: string;
  code: string;
  gameType: GameType;
  hostId: string;
  players: PlayerState[];
  currentQuestionIndex: number;
  status: SessionStatus;
  scores: Record<string, number>;
  createdAt: number;
  // Réponses de la question en cours, jamais envoyées au client tant que
  // les deux joueurs n'ont pas répondu.
  pendingAnswers: Record<string, AnswerRecord>;
}

// Ce que le client reçoit — ne contient JAMAIS les pendingAnswers de l'autre joueur.
export interface PublicRoomState {
  roomId: string;
  code: string;
  gameType: GameType;
  hostId: string;
  players: PlayerState[];
  status: SessionStatus;
  scores: Record<string, number>;
}
