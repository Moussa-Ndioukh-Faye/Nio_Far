import { GameView, RoomResultSummary, StandardReveal, StandardView } from "../../types";
import { ActionResult, DeckCard, Ruleset, RulesetHost } from "../rules";

const POINTS_PER_MATCH = 10;

export class StandardRules implements Ruleset {
  readonly family = "STANDARD" as const;

  private host: RulesetHost;
  private deck: DeckCard[] = [];
  private round = 1;
  private phase: "QUESTION" | "REVEAL" = "QUESTION";
  private currentCard: DeckCard | null = null;
  private answers: Record<string, string> = {};
  private reveal: StandardReveal | null = null;
  private finished = false;
  private matchingAnswers = 0;
  private differentAnswers = 0;
  private bestStreak = 0;
  private currentStreak = 0;

  constructor(host: RulesetHost) {
    this.host = host;
  }

  loadDeck(deck: DeckCard[]): void {
    this.deck = deck;
  }

  start(): ActionResult {
    this.round = 1;
    this.phase = "QUESTION";
    this.answers = {};
    this.reveal = null;
    this.finished = false;
    this.matchingAnswers = 0;
    this.differentAnswers = 0;
    this.bestStreak = 0;
    this.currentStreak = 0;
    if (!this.pickQuestion(1)) {
      return { ok: false, error: "EMPTY_DECK" };
    }
    return { ok: true };
  }

  act(playerId: string, action: string, payload: unknown): ActionResult {
    if (action === "answer") {
      if (this.finished || this.phase !== "QUESTION") return { ok: false, error: "WRONG_PHASE" };
      if (this.answers[playerId]) return { ok: false, error: "ALREADY_ANSWERED" };
      const p = this.host.players.find((pl) => pl.id === playerId);
      if (!p) return { ok: false, error: "NOT_IN_ROOM" };

      const value = String((payload as { value?: unknown })?.value ?? "").trim();
      if (!value) return { ok: false, error: "INVALID_ANSWER" };
      if (this.currentCard && this.currentCard.options.length > 0 && !this.currentCard.options.includes(value)) {
        return { ok: false, error: "INVALID_OPTION" };
      }

      this.answers[playerId] = value;
      const everyoneAnswered = this.host.players.length >= 2 && this.host.players.every((pl) => this.answers[pl.id]);

      if (everyoneAnswered) {
        this.phase = "REVEAL";
        this.reveal = this.computeReveal();
      }
      return { ok: true };
    }
    return { ok: false, error: "UNKNOWN_ACTION" };
  }

  next(playerId: string): ActionResult {
    if (this.finished) return { ok: false, error: "ALREADY_FINISHED" };
    if (this.phase !== "REVEAL") return { ok: false, error: "NOT_REVEALED_YET" };

    this.answers = {};
    this.reveal = null;
    this.round += 1;

    if (this.round > this.host.totalRounds || this.round - 1 >= this.deck.length) {
      this.finished = true;
      this.phase = "REVEAL";
      return { ok: true };
    }

    this.phase = "QUESTION";
    this.pickQuestion(this.round);
    return { ok: true };
  }

  getView(): GameView {
    if (this.finished) {
      return { kind: "FINISHED", result: this.computeResult() };
    }
    return {
      kind: "STANDARD",
      round: this.round,
      totalRounds: this.host.totalRounds,
      phase: this.phase,
      question: this.currentCard
        ? { cardId: this.currentCard.id, prompt: this.currentCard.content, options: this.currentCard.options, index: this.round - 1 }
        : null,
      answeredPlayerIds: Object.keys(this.answers),
      reveal: this.reveal,
    };
  }

  isFinished(): boolean {
    return this.finished;
  }

  getFinalResult(): RoomResultSummary {
    return this.computeResult();
  }

  // ---- interne ----

  private pickQuestion(round: number): boolean {
    const card = this.deck[round - 1];
    if (!card) return false;
    this.currentCard = card;
    return true;
  }

  private computeReveal(): StandardReveal {
    const values = Object.values(this.answers);
    const isMatch = values.length >= 2 && values[0] === values[1];

    const scoreDelta: Record<string, number> = {};
    for (const playerId of this.host.players.map((p) => p.id)) scoreDelta[playerId] = 0;

    if (this.host.scoringEnabled && isMatch) {
      for (const playerId of this.host.players.map((p) => p.id)) {
        scoreDelta[playerId] = POINTS_PER_MATCH;
        this.host.addScore(playerId, POINTS_PER_MATCH);
      }
    }

    if (isMatch) {
      this.matchingAnswers += 1;
      this.currentStreak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.currentStreak);
    } else {
      this.differentAnswers += 1;
      this.currentStreak = 0;
    }

    return { answers: { ...this.answers }, isMatch, scoreDelta };
  }

  private computeResult(): RoomResultSummary {
    const totalAnswers = this.matchingAnswers + this.differentAnswers;
    const coupleScorePct = totalAnswers > 0 ? Math.round((this.matchingAnswers / totalAnswers) * 100) : 0;
    const [p1, p2] = this.host.players;
    const summaryLabel = this.host.scoringEnabled
      ? `${coupleScorePct}% de complicité — ${this.matchingAnswers}/${totalAnswers} réponses en phase`
      : `❤️ ${this.matchingAnswers}/${totalAnswers} réponses en phase ensemble`;

    return {
      coupleScorePct,
      player1Score: p1?.score ?? 0,
      player2Score: p2?.score ?? 0,
      matchingAnswers: this.matchingAnswers,
      differentAnswers: this.differentAnswers,
      totalAnswers,
      bestStreak: this.bestStreak,
      summaryLabel,
    };
  }
}