import { GameView, RoomResultSummary, RoundRecap, StandardReveal } from "../../types";
import { ActionResult, DeckCard, Ruleset, RulesetHost, RulesOptions, verdictFor } from "../rules";

export const POINTS_PER_MATCH = 10;
export const SPEED_BONUS = 5;
/** marge laissée aux réponses parties juste avant la fin du chrono (latence réseau) */
const LATENCY_GRACE_MS = 400;

export const ME = "MOI";
export const PARTNER = "MON PARTENAIRE";
export const TIMEOUT_ANSWER = "⏱️ Temps écoulé";

/**
 * Règles « standard » : les deux joueurs répondent en même temps à la même
 * question, puis on révèle. Variante chronométrée si timerSeconds est fourni.
 */
export class StandardRules implements Ruleset {
  readonly family = "STANDARD" as const;

  private host: RulesetHost;
  private timerMs: number | null;
  private speedBonus: boolean;

  private deck: DeckCard[] = [];
  private round = 1;
  private phase: "QUESTION" | "REVEAL" = "QUESTION";
  private currentCard: DeckCard | null = null;
  private answers: Record<string, string> = {};
  private answerTimes: Record<string, number> = {};
  private questionStartedAt = 0;
  private deadline: number | null = null;
  private reveal: StandardReveal | null = null;
  private finished = false;
  private matchingAnswers = 0;
  private differentAnswers = 0;
  private bestStreak = 0;
  private currentStreak = 0;
  private recap: RoundRecap[] = [];

  constructor(host: RulesetHost, options: RulesOptions = {}) {
    this.host = host;
    this.timerMs = options.timerSeconds ? options.timerSeconds * 1000 : null;
    this.speedBonus = !!options.speedBonus;
  }

  loadDeck(deck: DeckCard[]): void {
    this.deck = deck;
  }

  start(): ActionResult {
    this.round = 1;
    this.phase = "QUESTION";
    this.answers = {};
    this.answerTimes = {};
    this.reveal = null;
    this.finished = false;
    this.matchingAnswers = 0;
    this.differentAnswers = 0;
    this.bestStreak = 0;
    this.currentStreak = 0;
    this.recap = [];
    if (!this.pickQuestion(1)) {
      return { ok: false, error: "EMPTY_DECK" };
    }
    return { ok: true };
  }

  act(playerId: string, action: string, payload: unknown): ActionResult {
    if (action !== "answer") return { ok: false, error: "UNKNOWN_ACTION" };
    if (this.finished || this.phase !== "QUESTION") return { ok: false, error: "WRONG_PHASE" };
    if (this.answers[playerId]) return { ok: false, error: "ALREADY_ANSWERED" };
    if (!this.host.players.find((pl) => pl.id === playerId)) return { ok: false, error: "NOT_IN_ROOM" };
    if (this.deadline !== null && this.host.now() > this.deadline + LATENCY_GRACE_MS) {
      return { ok: false, error: "TOO_LATE" };
    }

    const value = String((payload as { value?: unknown })?.value ?? "").trim();
    if (!value || value.length > 200) return { ok: false, error: "INVALID_ANSWER" };
    if (this.currentCard && this.currentCard.options.length > 0 && !this.currentCard.options.includes(value)) {
      return { ok: false, error: "INVALID_OPTION" };
    }

    this.answers[playerId] = value;
    this.answerTimes[playerId] = this.host.now() - this.questionStartedAt;

    const everyoneAnswered = this.host.players.length >= 2 && this.host.players.every((pl) => this.answers[pl.id]);
    if (everyoneAnswered) this.doReveal([]);
    return { ok: true };
  }

  /** Fin du chrono : les retardataires sont marqués « temps écoulé ». */
  onTimeout(): ActionResult {
    if (this.finished || this.phase !== "QUESTION" || this.deadline === null) return { ok: false, error: "NO_TIMER" };
    if (this.host.now() < this.deadline) return { ok: false, error: "TOO_EARLY" };
    const late = this.host.players.filter((p) => !this.answers[p.id]).map((p) => p.id);
    for (const id of late) this.answers[id] = TIMEOUT_ANSWER;
    this.doReveal(late);
    return { ok: true };
  }

  getDeadline(): number | null {
    return this.phase === "QUESTION" && !this.finished ? this.deadline : null;
  }

  next(_playerId: string): ActionResult {
    if (this.finished) return { ok: false, error: "ALREADY_FINISHED" };
    if (this.phase !== "REVEAL") return { ok: false, error: "NOT_REVEALED_YET" };

    this.answers = {};
    this.answerTimes = {};
    this.reveal = null;
    this.round += 1;

    if (this.round > this.host.totalRounds || this.round - 1 >= this.deck.length) {
      this.finished = true;
      this.deadline = null;
      this.round = Math.min(this.round, this.host.totalRounds);
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
      // on ne dit pas QUOI l'autre a répondu avant la révélation, seulement QU'il a répondu
      answeredPlayerIds: this.phase === "QUESTION" ? Object.keys(this.answers) : this.host.players.map((p) => p.id),
      reveal: this.reveal,
      deadline: this.getDeadline(),
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
    this.questionStartedAt = this.host.now();
    this.deadline = this.timerMs ? this.questionStartedAt + this.timerMs : null;
    return true;
  }

  /**
   * Questions « Qui de nous deux ? » : chacun répond de SON point de vue.
   * « MOI » chez Awa et « MON PARTENAIRE » chez Moussa désignent la même
   * personne (Awa) -> c'est une concordance, pas une divergence.
   */
  private isPerspectiveCard(): boolean {
    const opts = this.currentCard?.options ?? [];
    return opts.length === 2 && opts.includes(ME) && opts.includes(PARTNER);
  }

  private resolveTarget(playerId: string, value: string): string | null {
    if (value === ME) return playerId;
    if (value === PARTNER) return this.host.players.find((p) => p.id !== playerId)?.id ?? null;
    return null;
  }

  private doReveal(timedOut: string[]) {
    this.phase = "REVEAL";
    this.deadline = null;
    this.reveal = this.computeReveal(timedOut);
  }

  private computeReveal(timedOut: string[]): StandardReveal {
    const players = this.host.players;
    const perspective = this.isPerspectiveCard();
    const display: Record<string, string> = {};
    const normalized: Record<string, string> = {};

    for (const p of players) {
      const raw = this.answers[p.id] ?? TIMEOUT_ANSWER;
      if (timedOut.includes(p.id)) {
        display[p.id] = TIMEOUT_ANSWER;
        continue;
      }
      if (perspective) {
        const target = this.resolveTarget(p.id, raw);
        normalized[p.id] = target ?? raw;
        display[p.id] = players.find((pl) => pl.id === target)?.displayName ?? raw;
      } else {
        normalized[p.id] = raw.toLowerCase();
        display[p.id] = raw;
      }
    }

    const values = players.map((p) => normalized[p.id]);
    const isMatch = timedOut.length === 0 && values.length >= 2 && values[0] !== undefined && values.every((v) => v === values[0]);

    const scoreDelta: Record<string, number> = {};
    for (const p of players) scoreDelta[p.id] = 0;

    let fastestPlayerId: string | null = null;
    if (this.timerMs && timedOut.length === 0 && players.length >= 2) {
      const sorted = [...players].sort((a, b) => (this.answerTimes[a.id] ?? Infinity) - (this.answerTimes[b.id] ?? Infinity));
      if ((this.answerTimes[sorted[0].id] ?? 0) !== (this.answerTimes[sorted[1].id] ?? 0)) fastestPlayerId = sorted[0].id;
    }

    if (this.host.scoringEnabled && isMatch) {
      for (const p of players) {
        scoreDelta[p.id] = POINTS_PER_MATCH;
        this.host.addScore(p.id, POINTS_PER_MATCH);
      }
      if (this.speedBonus && fastestPlayerId) {
        scoreDelta[fastestPlayerId] += SPEED_BONUS;
        this.host.addScore(fastestPlayerId, SPEED_BONUS);
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

    this.recap.push({
      round: this.round,
      prompt: this.currentCard?.content ?? "",
      answers: { ...display },
      isMatch,
    });

    return { answers: { ...this.answers }, display, isMatch, scoreDelta, timedOut, fastestPlayerId };
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
      verdict: verdictFor(coupleScorePct, totalAnswers),
      rounds: [...this.recap],
    };
  }
}
