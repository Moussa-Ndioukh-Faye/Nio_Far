import { GameType, PlayerState, QuestionPayload, RoomState, SessionStatus } from "../types";

const MAX_PLAYERS = 2;
const RECONNECT_GRACE_MS = 60_000; // 60s avant d'abandonner la partie (règle 5 & 24)

export interface ContentItem {
  id: string;
  prompt: string;
  options: string[];
}

/**
 * GameEngine : logique pure d'une partie (une instance = une room).
 * Ne connaît rien de Socket.IO ni de React — testable unitairement.
 * Le serveur (socket layer) est le seul appelant ; le client n'a jamais
 * un accès direct à cette classe.
 */
export class GameEngine {
  private state: RoomState;
  private questions: ContentItem[];
  private disconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(params: {
    roomId: string;
    code: string;
    gameType: GameType;
    hostId: string;
    questions: ContentItem[];
  }) {
    this.questions = params.questions;
    this.state = {
      roomId: params.roomId,
      code: params.code,
      gameType: params.gameType,
      hostId: params.hostId,
      players: [],
      currentQuestionIndex: 0,
      status: "WAITING",
      scores: {},
      createdAt: Date.now(),
      pendingAnswers: {},
    };
  }

  // ---- Joueurs ----

  addPlayer(player: { id: string; displayName: string; socketId: string }): { ok: true } | { ok: false; reason: string } {
    if (this.state.players.find((p) => p.id === player.id)) {
      // reconnexion logique gérée par reconnectPlayer(), pas ici
      return { ok: false, reason: "PLAYER_ALREADY_IN_ROOM" };
    }
    if (this.state.players.length >= MAX_PLAYERS) {
      return { ok: false, reason: "ROOM_FULL" };
    }
    this.state.players.push({
      id: player.id,
      displayName: player.displayName,
      socketId: player.socketId,
      isConnected: true,
      isReady: false,
      score: 0,
    });
    this.state.scores[player.id] = 0;
    return { ok: true };
  }

  removePlayer(playerId: string) {
    this.state.players = this.state.players.filter((p) => p.id !== playerId);
    this.clearDisconnectTimer(playerId);
  }

  setPlayerReady(playerId: string, ready: boolean) {
    const p = this.state.players.find((pl) => pl.id === playerId);
    if (p) p.isReady = ready;
    if (this.state.players.length === MAX_PLAYERS && this.state.players.every((pl) => pl.isReady)) {
      this.state.status = "READY";
    }
  }

  markDisconnected(playerId: string, onTimeout: () => void) {
    const p = this.state.players.find((pl) => pl.id === playerId);
    if (!p) return;
    p.isConnected = false;
    p.socketId = null;
    this.clearDisconnectTimer(playerId);
    const timer = setTimeout(() => {
      // Toujours déconnecté après le délai de grâce -> abandon
      const stillGone = this.state.players.find((pl) => pl.id === playerId && !pl.isConnected);
      if (stillGone) {
        this.state.status = "ABANDONED";
        onTimeout();
      }
    }, RECONNECT_GRACE_MS);
    this.disconnectTimers.set(playerId, timer);
  }

  reconnectPlayer(playerId: string, newSocketId: string): boolean {
    const p = this.state.players.find((pl) => pl.id === playerId);
    if (!p) return false;
    p.isConnected = true;
    p.socketId = newSocketId;
    this.clearDisconnectTimer(playerId);
    return true;
  }

  private clearDisconnectTimer(playerId: string) {
    const t = this.disconnectTimers.get(playerId);
    if (t) {
      clearTimeout(t);
      this.disconnectTimers.delete(playerId);
    }
  }

  // ---- Déroulé de partie ----

  canStart(): boolean {
    return (
      this.state.players.length === MAX_PLAYERS &&
      this.state.players.every((p) => p.isReady) &&
      this.state.status === "READY"
    );
  }

  start() {
    if (!this.canStart()) throw new Error("CANNOT_START");
    this.state.status = "PLAYING";
    this.state.currentQuestionIndex = 0;
    this.state.pendingAnswers = {};
  }

  /** Question actuelle, formatée pour le client (jamais la réponse correcte / celle du partenaire). */
  getCurrentQuestionForClient(): QuestionPayload | null {
    const q = this.questions[this.state.currentQuestionIndex];
    if (!q) return null;
    return {
      id: q.id,
      prompt: q.prompt,
      options: q.options,
      index: this.state.currentQuestionIndex,
      total: this.questions.length,
    };
  }

  /**
   * Enregistre la réponse d'un joueur. Rejette une double réponse
   * (règle anti-triche #24.8). Retourne si les deux ont répondu.
   */
  submitAnswer(playerId: string, value: string): { ok: boolean; reason?: string; bothAnswered?: boolean } {
    if (this.state.status !== "PLAYING") return { ok: false, reason: "NOT_PLAYING" };
    if (this.state.pendingAnswers[playerId]) return { ok: false, reason: "ALREADY_ANSWERED" };
    this.state.pendingAnswers[playerId] = { playerId, value, submittedAt: Date.now() };

    const bothAnswered = this.state.players.every((p) => this.state.pendingAnswers[p.id]);
    if (bothAnswered) this.state.status = "REVEALING";
    return { ok: true, bothAnswered };
  }

  /** Calcule et applique les points, retourne les réponses à révéler simultanément. */
  reveal(): {
    answers: Record<string, string>;
    isMatch: boolean;
    scoreDelta: Record<string, number>;
  } {
    const answers: Record<string, string> = {};
    for (const [playerId, rec] of Object.entries(this.state.pendingAnswers)) {
      answers[playerId] = rec.value;
    }
    const values = Object.values(answers);
    const isMatch = values.length === MAX_PLAYERS && values[0] === values[1];

    const scoreDelta: Record<string, number> = {};
    for (const p of this.state.players) scoreDelta[p.id] = 0;

    if (this.state.gameType === "COUPLE_BATTLE" && !isMatch) {
      // Pas de "bonne" réponse objective : on ne score pas automatiquement
      // ici (dépend du consensus du couple côté UI) — laissé à 0 par défaut,
      // extensible selon les règles précises du jeu.
    } else if (isMatch) {
      for (const p of this.state.players) scoreDelta[p.id] = 10;
    }

    for (const p of this.state.players) {
      p.score += scoreDelta[p.id] ?? 0;
      this.state.scores[p.id] = p.score;
    }

    return { answers, isMatch, scoreDelta };
  }

  nextQuestion(): { finished: boolean } {
    this.state.pendingAnswers = {};
    this.state.currentQuestionIndex += 1;
    if (this.state.currentQuestionIndex >= this.questions.length) {
      this.state.status = "FINISHED";
      return { finished: true };
    }
    this.state.status = "PLAYING";
    return { finished: false };
  }

  getFinalResult() {
    const [p1, p2] = this.state.players;
    const total = (p1?.score ?? 0) + (p2?.score ?? 0);
    const maxPossible = this.questions.length * 10 * MAX_PLAYERS || 1;
    const coupleScorePct = Math.round((total / maxPossible) * 100);
    return {
      coupleScorePct: Math.min(100, coupleScorePct),
      player1Score: p1?.score ?? 0,
      player2Score: p2?.score ?? 0,
    };
  }

  // ---- Accès à l'état public (jamais pendingAnswers de l'autre joueur) ----

  getPublicState() {
    const { pendingAnswers, ...rest } = this.state;
    return {
      ...rest,
      // le client sait seulement QUI a déjà répondu, pas la valeur
      answeredPlayerIds: Object.keys(pendingAnswers),
    };
  }

  getStatus(): SessionStatus {
    return this.state.status;
  }

  getPlayers(): PlayerState[] {
    return this.state.players;
  }

  getHostId(): string {
    return this.state.hostId;
  }

  getRoomId(): string {
    return this.state.roomId;
  }

  getCode(): string {
    return this.state.code;
  }
}
