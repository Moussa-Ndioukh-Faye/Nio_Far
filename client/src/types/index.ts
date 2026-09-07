export type GameType = "GUESS_ME" | "COUPLE_BATTLE" | "TRUTH_OR_DARE";
export type SessionStatus = "WAITING" | "READY" | "PLAYING" | "REVEALING" | "FINISHED" | "ABANDONED";

export interface PlayerState {
  id: string;
  displayName: string;
  socketId: string | null;
  isConnected: boolean;
  isReady: boolean;
  score: number;
}

export interface PublicRoomState {
  roomId: string;
  code: string;
  gameType: GameType;
  hostId: string;
  players: PlayerState[];
  status: SessionStatus;
  scores: Record<string, number>;
  answeredPlayerIds: string[];
}

export interface QuestionPayload {
  id: string;
  prompt: string;
  options: string[];
  index: number;
  total: number;
}

export interface ChatMessage {
  playerId: string;
  text: string;
  createdAt: number;
}
