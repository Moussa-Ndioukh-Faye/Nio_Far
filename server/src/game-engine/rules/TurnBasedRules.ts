import { GameView, RoomResultSummary, TurnBasedView } from "../../types";
import { ActionResult, DeckCard, Ruleset, RulesetHost } from "../rules";

const POINTS_PER_DONE = 5;

export class TurnBasedRules implements Ruleset {
  readonly family = "TURN_BASED" as const;

  private host: RulesetHost;
  private cardTypes: string[];
  private deckByType: Map<string, DeckCard[]> = new Map();
  private deckCursorByType: Map<string, number> = new Map();

  private round = 1;
  private turnIdx = 0;
  private phase: "CHOOSE" | "CARD" | "RESOLVED" = "CHOOSE";
  private choseType: string | null = null;
  private currentCard: DeckCard | null = null;
  private resolution: { result: "DONE" | "PASS"; byPlayerId: string } | null = null;
  private doneCount = 0;
  private passCount = 0;
  private finished = false;

  constructor(host: RulesetHost, cardTypes: string[]) {
    this.host = host;
    this.cardTypes = cardTypes.length > 0 ? cardTypes : ["CHALLENGE"];
  }

  loadDeck(deck: DeckCard[]): void {
    this.deckByType = new Map();
    this.deckCursorByType = new Map();
    for (const cardType of this.cardTypes) this.deckByType.set(cardType, []);
    for (const card of deck) {
      const type = card.type || "CHALLENGE";
      if (!this.cardTypes.includes(type)) continue;
      this.deckByType.get(type)!.push(card); // une carte partagée ? non, par type
    }
    for (const key of this.deckByType.keys()) this.deckCursorByType.set(key, 0);
  }

  start(): ActionResult {
    this.round = 1;
    this.turnIdx = 0;
    this.phase = "CHOOSE";
    this.choseType = null;
    this.currentCard = null;
    this.resolution = null;
    this.doneCount = 0;
    this.passCount = 0;
    this.finished = false;
    const turn = this.currentTurnPlayer();
    this.host.turnPlayerId = turn?.id ?? null;
    if (!turn) return { ok: false, error: "NO_PLAYERS" };
    return { ok: true };
  }

  act(playerId: string, action: string, payload: unknown): ActionResult {
    const turn = this.currentTurnPlayer();
    if (!turn) return { ok: false, error: "NOT_IN_ROOM" };
    if (playerId !== turn.id) return { ok: false, error: "NOT_YOUR_TURN" };

    if (action === "choose") {
      if (this.phase !== "CHOOSE") return { ok: false, error: "WRONG_PHASE" };
      const requested = String((payload as { type?: unknown })?.type ?? "");
      let type = requested;
      if (!this.cardTypes.includes(type)) {
        // tolérance : si le type demandé n'existe pas, on pioche dans les types dispos
        const available = this.cardTypes.filter((t) => this.peekCard(t));
        if (available.length === 0) return { ok: false, error: "NO_MORE_CARDS" };
        type = available[0];
      }
      const card = this.pickCard(type);
      if (!card) {
        const available = this.cardTypes.filter((t) => this.peekCard(t));
        if (available.length === 0) return { ok: false, error: "NO_MORE_CARDS" };
        type = available[0];
        const fallback = this.pickCard(type);
        if (!fallback) return { ok: false, error: "NO_MORE_CARDS" };
        this.currentCard = fallback;
      } else {
        this.currentCard = card;
      }
      this.choseType = type;
      this.phase = "CARD";
      return { ok: true };
    }

    if (action === "resolve") {
      if (this.phase !== "CARD") return { ok: false, error: "WRONG_PHASE" };
      const result = String((payload as { result?: unknown })?.result ?? "");
      if (result !== "DONE" && result !== "PASS") return { ok: false, error: "INVALID_RESULT" };
      this.resolution = { result, byPlayerId: playerId };
      if (result === "DONE") {
        this.doneCount += 1;
        if (this.host.scoringEnabled) {
          this.host.addScore(playerId, POINTS_PER_DONE);
        }
      } else {
        this.passCount += 1;
      }
      this.phase = "RESOLVED";
      return { ok: true };
    }

    return { ok: false, error: "UNKNOWN_ACTION" };
  }

  next(playerId: string): ActionResult {
    if (this.finished) return { ok: false, error: "ALREADY_FINISHED" };
    if (this.phase !== "RESOLVED") return { ok: false, error: "NOT_RESOLVED_YET" };
    if (!this.host.players.find((p) => p.id === playerId)) return { ok: false, error: "NOT_IN_ROOM" };

    this.phase = "CHOOSE";
    this.choseType = null;
    this.currentCard = null;
    this.resolution = null;
    this.round += 1;

    if (this.round > this.host.totalRounds) {
      this.finished = true;
      this.phase = "RESOLVED";
      return { ok: true };
    }

    this.turnIdx = (this.turnIdx + 1) % this.host.players.length;
    const turn = this.currentTurnPlayer();
    this.host.turnPlayerId = turn?.id ?? null;
    return { ok: true };
  }

  getView(): GameView {
    if (this.finished) {
      return { kind: "FINISHED", result: this.getFinalResult() };
    }
    const turn = this.currentTurnPlayer();
    return {
      kind: "TURN_BASED",
      round: this.round,
      totalRounds: this.host.totalRounds,
      turnPlayerId: turn?.id ?? null,
      phase: this.phase,
      options: this.phase === "CHOOSE" ? this.cardTypes : [],
      choseType: this.choseType,
      card: this.currentCard ? { type: this.currentCard.type, content: this.currentCard.content } : null,
      resolution: this.resolution,
      status: this.statusText(),
    };
  }

  isFinished(): boolean {
    return this.finished;
  }

  getFinalResult(): RoomResultSummary {
    const totalAnswers = this.doneCount + this.passCount;
    const coupleScorePct = totalAnswers > 0 ? Math.round((this.doneCount / totalAnswers) * 100) : 0;
    const [p1, p2] = this.host.players;
    const summaryLabel = this.host.scoringEnabled
      ? `${coupleScorePct}% de réussite — ${this.doneCount} défis relevés`
      : `🔥 ${this.doneCount} défis réalisés, ${this.passCount} passés`;
    return {
      coupleScorePct,
      player1Score: p1?.score ?? 0,
      player2Score: p2?.score ?? 0,
      matchingAnswers: this.doneCount,
      differentAnswers: this.passCount,
      totalAnswers,
      bestStreak: 0,
      summaryLabel,
    };
  }

  // ---- interne ----

  private currentTurnPlayer() {
    const players = this.host.players;
    if (players.length === 0) return null;
    return players[this.turnIdx % players.length];
  }

  private peekCard(type: string): DeckCard | null {
    const list = this.deckByType.get(type) ?? [];
    const cursor = this.deckCursorByType.get(type) ?? 0;
    return list[cursor] ?? null;
  }

  private pickCard(type: string): DeckCard | null {
    const card = this.peekCard(type);
    if (!card) return null;
    this.deckCursorByType.set(type, (this.deckCursorByType.get(type) ?? 0) + 1);
    return card;
  }

  private statusText(): string {
    const turn = this.currentTurnPlayer();
    if (this.phase === "CHOOSE") return `C'est à ${turn?.displayName ?? "…"} de choisir (${this.round}/${this.host.totalRounds})`;
    if (this.phase === "CARD") return `Carte en jeu — ${turn?.displayName ?? "…"} doit répondre`;
    if (this.resolution?.result === "DONE") return "✅ Relevé ! Prêt pour le tour suivant";
    return "🔄 Passé. Prêt pour le tour suivant";
  }
}