import {
  Category,
  ChatMessage,
  Difficulty,
  GameFamily,
  GameMeta,
  GameType,
  PlayerState,
  RoomResultSummary,
  SessionPublicState,
  SessionStatus,
} from "../types";
import { ActionResult, DeckCard, Ruleset, RulesetHost } from "./rules";

const MAX_PLAYERS = 2;
const RECONNECT_GRACE_MS = 60_000;
const CHAT_HISTORY = 100;

/**
 * GameEngine : hôte de partie unique, indépendant de la mécanique.
 * Une instance = une room. Il gère joueurs, statuts, scores, chrono, chat
 * et revanche, et délègue le déroulé de manche à la Règle
 * (StandardRules / TurnBasedRules). La couche socket lit getPublicState()
 * et diffuse ; quand l'état change tout seul (fin de chrono), le moteur
 * prévient via le listener enregistré par setUpdateListener().
 */
export class GameEngine implements RulesetHost {
  private meta: GameMeta;
  private rules: Ruleset;
  private deck: DeckCard[];
  private baseTotalRounds: number;
  private family: GameFamily;
  private clock: () => number;
  private disconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private roundTimer: NodeJS.Timeout | null = null;
  private onUpdate: (() => void) | null = null;
  private chat: ChatMessage[] = [];

  constructor(params: {
    roomId: string;
    code: string;
    gameType: GameType;
    category: Category;
    difficulty: Difficulty;
    gameName: string;
    family: GameFamily;
    scoringEnabled: boolean;
    totalRounds: number;
    hostId: string;
    deck: DeckCard[];
    buildRules: (host: RulesetHost) => Ruleset;
    timerSeconds?: number | null;
    clock?: () => number;
  }) {
    this.clock = params.clock ?? Date.now;
    this.deck = params.deck;
    this.family = params.family;
    this.baseTotalRounds = params.totalRounds;
    this.meta = {
      roomId: params.roomId,
      code: params.code,
      gameType: params.gameType,
      category: params.category,
      difficulty: params.difficulty,
      gameName: params.gameName,
      family: params.family,
      scoringEnabled: params.scoringEnabled,
      totalRounds: params.totalRounds,
      currentRound: 0,
      turnPlayerId: null,
      hostId: params.hostId,
      players: [],
      status: "WAITING",
      scores: {},
      createdAt: this.clock(),
      rematchVotes: [],
      gamesPlayed: 0,
      timerSeconds: params.timerSeconds ?? null,
    };
    this.rules = params.buildRules(this);
    this.applyDeck(params.deck);
  }

  // ---- Implémentation RulesetHost ----

  get players(): PlayerState[] {
    return this.meta.players;
  }

  get scores(): Record<string, number> {
    return this.meta.scores;
  }

  get scoringEnabled(): boolean {
    return this.meta.scoringEnabled;
  }

  get totalRounds(): number {
    return this.meta.totalRounds;
  }

  get gameType(): GameType {
    return this.meta.gameType;
  }

  get round(): number {
    return this.meta.currentRound;
  }

  set round(value: number) {
    this.meta.currentRound = value;
  }

  get turnPlayerId(): string | null {
    return this.meta.turnPlayerId;
  }

  set turnPlayerId(value: string | null) {
    this.meta.turnPlayerId = value;
  }

  now(): number {
    return this.clock();
  }

  addScore(playerId: string, delta: number) {
    const p = this.meta.players.find((pl) => pl.id === playerId);
    if (!p) return;
    p.score += delta;
    this.meta.scores[playerId] = (this.meta.scores[playerId] ?? 0) + delta;
  }

  /** Appelé quand l'état change sans action d'un joueur (fin de chrono). */
  setUpdateListener(fn: () => void) {
    this.onUpdate = fn;
  }

  // ---- Joueurs ----

  addPlayer(player: { id: string; displayName: string; socketId: string }): { ok: true } | { ok: false; reason: string } {
    if (this.meta.players.find((p) => p.id === player.id)) {
      return { ok: false, reason: "PLAYER_ALREADY_IN_ROOM" };
    }
    if (this.meta.players.length >= MAX_PLAYERS) {
      return { ok: false, reason: "ROOM_FULL" };
    }
    this.meta.players.push({
      id: player.id,
      displayName: player.displayName,
      socketId: player.socketId,
      isConnected: true,
      isReady: false,
      score: 0,
    });
    this.meta.scores[player.id] = 0;
    return { ok: true };
  }

  removePlayer(playerId: string) {
    this.meta.players = this.meta.players.filter((p) => p.id !== playerId);
    delete this.meta.scores[playerId];
    this.meta.rematchVotes = this.meta.rematchVotes.filter((id) => id !== playerId);
    this.clearDisconnectTimer(playerId);
  }

  setPlayerReady(playerId: string, ready: boolean) {
    const p = this.meta.players.find((pl) => pl.id === playerId);
    if (p) p.isReady = ready;
    if (this.meta.status !== "WAITING" && this.meta.status !== "READY") return;
    if (this.meta.players.length === MAX_PLAYERS && this.meta.players.every((pl) => pl.isReady)) {
      this.meta.status = "READY";
    } else if (this.meta.status === "READY") {
      this.meta.status = "WAITING";
    }
  }

  markDisconnected(playerId: string, onTimeout: () => void) {
    const p = this.meta.players.find((pl) => pl.id === playerId);
    if (!p) return;
    p.isConnected = false;
    p.socketId = null;
    this.clearDisconnectTimer(playerId);
    const timer = setTimeout(() => {
      const stillGone = this.meta.players.find((pl) => pl.id === playerId && !pl.isConnected);
      if (stillGone) {
        this.meta.status = "ABANDONED";
        this.clearRoundTimer();
        onTimeout();
      }
    }, RECONNECT_GRACE_MS);
    this.disconnectTimers.set(playerId, timer);
  }

  reconnectPlayer(playerId: string, newSocketId: string): boolean {
    const p = this.meta.players.find((pl) => pl.id === playerId);
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

  // ---- Déroulé ----

  canStart(): boolean {
    return (
      this.meta.players.length === MAX_PLAYERS &&
      this.meta.players.every((p) => p.isReady) &&
      this.meta.status === "READY"
    );
  }

  start(): ActionResult {
    if (!this.canStart()) return { ok: false, error: "NOT_READY" };
    this.meta.status = "PLAYING";
    this.meta.gamesPlayed = 1;
    const res = this.rules.start();
    this.syncRoundTimer();
    return res;
  }

  /** Action générique du ruleset (ex: answer, choose, submit, judge…). */
  act(playerId: string, action: string, payload: unknown): ActionResult {
    if (this.meta.status !== "PLAYING") return { ok: false, error: "NOT_PLAYING" };
    const res = this.rules.act(playerId, action, payload);
    this.syncRoundTimer();
    return res;
  }

  /** Progression (question suivante, tour suivant…). */
  next(playerId: string): ActionResult {
    if (this.meta.status !== "PLAYING") return { ok: false, error: "NOT_PLAYING" };
    const res = this.rules.next(playerId);
    if (res.ok && this.rules.isFinished()) {
      this.meta.status = "FINISHED";
      this.meta.rematchVotes = [];
    }
    this.syncRoundTimer();
    return res;
  }

  /** Vote pour une revanche ; `ready` = les deux joueurs ont voté. */
  voteRematch(playerId: string): { ok: boolean; error?: string; ready?: boolean } {
    if (this.meta.status !== "FINISHED") return { ok: false, error: "NOT_FINISHED" };
    if (!this.meta.players.find((p) => p.id === playerId)) return { ok: false, error: "NOT_IN_ROOM" };
    if (!this.meta.rematchVotes.includes(playerId)) this.meta.rematchVotes.push(playerId);
    const ready = this.meta.players.length === MAX_PLAYERS && this.meta.players.every((p) => this.meta.rematchVotes.includes(p.id));
    return { ok: true, ready };
  }

  /** Relance une partie du même jeu dans la même room, avec un nouveau paquet. */
  restart(deck: DeckCard[]): ActionResult {
    if (this.meta.status !== "FINISHED") return { ok: false, error: "NOT_FINISHED" };
    for (const p of this.meta.players) {
      p.score = 0;
      this.meta.scores[p.id] = 0;
    }
    // l'autre commence cette fois-ci (tour par tour)
    if (this.meta.players.length === MAX_PLAYERS) this.meta.players.reverse();
    this.meta.rematchVotes = [];
    this.meta.currentRound = 0;
    this.meta.turnPlayerId = null;
    this.deck = deck;
    this.applyDeck(deck);
    this.meta.status = "PLAYING";
    this.meta.gamesPlayed += 1;
    const res = this.rules.start();
    this.syncRoundTimer();
    return res;
  }

  // ---- Chrono ----

  private syncRoundTimer() {
    this.clearRoundTimer();
    if (this.meta.status !== "PLAYING") return;
    const deadline = this.rules.getDeadline();
    if (deadline === null) return;
    const delay = Math.max(0, deadline - this.clock()) + 50;
    this.roundTimer = setTimeout(() => this.handleTimeout(), delay);
  }

  /** Public pour les tests (horloge factice) ; appelé par le timer en prod. */
  handleTimeout(): ActionResult {
    this.roundTimer = null;
    if (this.meta.status !== "PLAYING") return { ok: false, error: "NOT_PLAYING" };
    const res = this.rules.onTimeout();
    if (res.ok) {
      this.syncRoundTimer();
      this.onUpdate?.();
    } else if (res.error === "TOO_EARLY") {
      this.syncRoundTimer();
    }
    return res;
  }

  private clearRoundTimer() {
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
  }

  /** Libère tous les timers (room détruite). */
  dispose() {
    this.clearRoundTimer();
    for (const t of this.disconnectTimers.values()) clearTimeout(t);
    this.disconnectTimers.clear();
    this.onUpdate = null;
  }

  // ---- Chat ----

  addChat(message: ChatMessage) {
    this.chat.push(message);
    if (this.chat.length > CHAT_HISTORY) this.chat.splice(0, this.chat.length - CHAT_HISTORY);
  }

  getChat(): ChatMessage[] {
    return [...this.chat];
  }

  // ---- État public ----

  getPublicState(): SessionPublicState {
    return {
      // socketId reste côté serveur : il n'a rien à faire chez les clients.
      meta: {
        ...this.meta,
        players: this.meta.players.map(({ socketId: _socketId, ...p }) => ({ ...p })),
        rematchVotes: [...this.meta.rematchVotes],
      },
      view: this.rules.getView(),
      serverNow: this.clock(),
    };
  }

  getStatus(): SessionStatus {
    return this.meta.status;
  }

  getPlayers(): PlayerState[] {
    return this.meta.players;
  }

  getHostId(): string {
    return this.meta.hostId;
  }

  getRoomId(): string {
    return this.meta.roomId;
  }

  getCode(): string {
    return this.meta.code;
  }

  getGameType(): GameType {
    return this.meta.gameType;
  }

  getMetaData(): GameMeta {
    return { ...this.meta };
  }

  getDeck(): DeckCard[] {
    return this.deck;
  }

  getFinalResult(): RoomResultSummary {
    return this.rules.getFinalResult();
  }

  private applyDeck(deck: DeckCard[]) {
    this.rules.loadDeck(deck);
    // Adapter totalRounds au nombre de cartes réellement disponibles : le
    // compteur « 3/20 » ne doit pas promettre plus de manches que le paquet.
    this.meta.totalRounds = Math.max(1, Math.min(this.baseTotalRounds, deck.length));
  }
}
