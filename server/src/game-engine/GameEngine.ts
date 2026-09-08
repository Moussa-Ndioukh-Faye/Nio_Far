import { Category, Difficulty, GameFamily, GameMeta, GameType, PlayerState, RoomResultSummary, SessionPublicState, SessionStatus } from "../types";
import { ActionResult, DeckCard, Ruleset, RulesetHost } from "./rules";

const MAX_PLAYERS = 2;
const RECONNECT_GRACE_MS = 60_000;

/**
 * GameEngine : hôte de partie unique, indépendant de la mécanique.
 * Une instance = une room. Il gère joueurs, statuts et scores, et délègue
 * le déroulé de manche à la Règle (StandardRules / TurnBasedRules).
 * Purement synchrone — la couche socket lit getPublicState() et diffuse.
 */
export class GameEngine implements RulesetHost {
  private meta: GameMeta;
  private rules: Ruleset;
  private deck: DeckCard[];
  private disconnectTimers: Map<string, NodeJS.Timeout> = new Map();

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
  }) {
    this.deck = params.deck;
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
      createdAt: Date.now(),
    };
    this.rules = params.buildRules(this);
    this.rules.loadDeck(params.deck);
    // Adapter totalRounds à la taille réelle du deck pour éviter les erreurs de fin prématurée.
    if (params.family === "STANDARD") {
      this.meta.totalRounds = Math.min(params.totalRounds, params.deck.length);
    }
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

  addScore(playerId: string, delta: number) {
    const p = this.meta.players.find((pl) => pl.id === playerId);
    if (!p) return;
    p.score += delta;
    this.meta.scores[playerId] = (this.meta.scores[playerId] ?? 0) + delta;
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
    this.clearDisconnectTimer(playerId);
  }

  setPlayerReady(playerId: string, ready: boolean) {
    const p = this.meta.players.find((pl) => pl.id === playerId);
    if (p) p.isReady = ready;
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
    return this.rules.start();
  }

  /** Action générique du ruleset (ex: answer, choose, resolve). */
  act(playerId: string, action: string, payload: unknown): ActionResult {
    if (this.meta.status !== "PLAYING") return { ok: false, error: "NOT_PLAYING" };
    return this.rules.act(playerId, action, payload);
  }

  /** Progression (question suivante, tour suivant…). */
  next(playerId: string): ActionResult {
    if (this.meta.status !== "PLAYING") return { ok: false, error: "NOT_PLAYING" };
    const res = this.rules.next(playerId);
    if (res.ok && this.rules.isFinished()) {
      this.meta.status = "FINISHED";
    }
    return res;
  }

  // ---- État public ----

  getPublicState(): SessionPublicState {
    return {
      meta: { ...this.meta, players: this.meta.players.map((p) => ({ ...p })) },
      view: this.rules.getView(),
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
}