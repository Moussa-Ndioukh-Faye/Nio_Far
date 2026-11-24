import { GameView, RoomResultSummary, RoundRecap, TurnResult } from "../../types";
import { ActionResult, DeckCard, Ruleset, RulesetHost, verdictFor } from "../rules";

export const POINTS_PER_DONE = 5;
const MAX_TEXT = 500;

/** Cartes auxquelles on répond par écrit (le partenaire est à distance). */
const WRITTEN_TYPES = new Set(["TRUTH", "QUESTION", "PROMPT"]);

/**
 * Règles « tour par tour » (Action ou Vérité, Mime, Défis…).
 *
 *  CHOOSE  -> le joueur du tour choisit un type de carte
 *  CARD    -> il répond (texte) ou réalise l'action, puis « submit » — ou « pass »
 *  JUDGE   -> son/sa partenaire valide (DONE) ou non (REJECTED)
 *  RESOLVED-> n'importe qui passe au tour suivant
 *
 * On ne s'auto-valide plus : c'est l'autre qui juge, comme autour d'une vraie table.
 */
export class TurnBasedRules implements Ruleset {
  readonly family = "TURN_BASED" as const;

  private host: RulesetHost;
  private cardTypes: string[];
  private deckByType: Map<string, DeckCard[]> = new Map();
  private deckCursorByType: Map<string, number> = new Map();

  private round = 1;
  private turnIdx = 0;
  private phase: "CHOOSE" | "CARD" | "JUDGE" | "RESOLVED" = "CHOOSE";
  private choseType: string | null = null;
  private currentCard: DeckCard | null = null;
  private submission: { text: string | null } | null = null;
  private resolution: { result: TurnResult; byPlayerId: string } | null = null;
  private doneCount = 0;
  private passCount = 0;
  private rejectedCount = 0;
  private currentStreak = 0;
  private bestStreak = 0;
  private finished = false;
  private recap: RoundRecap[] = [];

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
      this.deckByType.get(type)!.push(card);
    }
    for (const key of this.deckByType.keys()) this.deckCursorByType.set(key, 0);
  }

  start(): ActionResult {
    this.round = 1;
    this.turnIdx = 0;
    this.phase = "CHOOSE";
    this.choseType = null;
    this.currentCard = null;
    this.submission = null;
    this.resolution = null;
    this.doneCount = 0;
    this.passCount = 0;
    this.rejectedCount = 0;
    this.currentStreak = 0;
    this.bestStreak = 0;
    this.finished = false;
    this.recap = [];
    const turn = this.currentTurnPlayer();
    this.host.turnPlayerId = turn?.id ?? null;
    if (!turn) return { ok: false, error: "NO_PLAYERS" };
    // Un seul type de carte : pas de choix à faire, on pioche directement.
    if (this.cardTypes.length === 1) this.drawCard(this.cardTypes[0]);
    return { ok: true };
  }

  act(playerId: string, action: string, payload: unknown): ActionResult {
    const turn = this.currentTurnPlayer();
    if (!turn) return { ok: false, error: "NOT_IN_ROOM" };
    if (!this.host.players.find((p) => p.id === playerId)) return { ok: false, error: "NOT_IN_ROOM" };
    if (this.finished) return { ok: false, error: "ALREADY_FINISHED" };

    // Compat : ancien client qui envoyait resolve {DONE|PASS}
    if (action === "resolve") {
      const r = String((payload as { result?: unknown })?.result ?? "");
      action = r === "PASS" ? "pass" : "submit";
    }

    switch (action) {
      case "choose": {
        if (playerId !== turn.id) return { ok: false, error: "NOT_YOUR_TURN" };
        if (this.phase !== "CHOOSE") return { ok: false, error: "WRONG_PHASE" };
        const requested = String((payload as { type?: unknown })?.type ?? "");
        return this.drawCard(requested);
      }

      case "submit": {
        if (playerId !== turn.id) return { ok: false, error: "NOT_YOUR_TURN" };
        if (this.phase !== "CARD") return { ok: false, error: "WRONG_PHASE" };
        const raw = (payload as { text?: unknown })?.text;
        const text = typeof raw === "string" ? raw.trim().slice(0, MAX_TEXT) : "";
        if (this.needsText() && !text) return { ok: false, error: "TEXT_REQUIRED" };
        this.submission = { text: text || null };
        this.phase = "JUDGE";
        return { ok: true };
      }

      case "pass": {
        if (playerId !== turn.id) return { ok: false, error: "NOT_YOUR_TURN" };
        if (this.phase !== "CARD") return { ok: false, error: "WRONG_PHASE" };
        this.resolve("PASS", playerId);
        return { ok: true };
      }

      case "judge": {
        if (playerId === turn.id) return { ok: false, error: "CANNOT_JUDGE_YOURSELF" };
        if (this.phase !== "JUDGE") return { ok: false, error: "WRONG_PHASE" };
        const r = String((payload as { result?: unknown })?.result ?? "");
        if (r !== "DONE" && r !== "REJECTED") return { ok: false, error: "INVALID_RESULT" };
        this.resolve(r, turn.id);
        return { ok: true };
      }
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
    this.submission = null;
    this.resolution = null;

    if (this.round + 1 > this.host.totalRounds || !this.cardTypes.some((t) => this.peekCard(t))) {
      this.finished = true;
      this.phase = "RESOLVED";
      return { ok: true };
    }

    this.round += 1;
    this.turnIdx = (this.turnIdx + 1) % this.host.players.length;
    const turn = this.currentTurnPlayer();
    this.host.turnPlayerId = turn?.id ?? null;
    if (this.cardTypes.length === 1) this.drawCard(this.cardTypes[0]);
    return { ok: true };
  }

  getDeadline(): number | null {
    return null;
  }

  onTimeout(): ActionResult {
    return { ok: false, error: "NO_TIMER" };
  }

  getView(): GameView {
    if (this.finished) {
      return { kind: "FINISHED", result: this.getFinalResult() };
    }
    const turn = this.currentTurnPlayer();
    const judge = this.host.players.find((p) => p.id !== turn?.id) ?? null;
    return {
      kind: "TURN_BASED",
      round: this.round,
      totalRounds: this.host.totalRounds,
      turnPlayerId: turn?.id ?? null,
      judgePlayerId: judge?.id ?? null,
      phase: this.phase,
      options: this.phase === "CHOOSE" ? this.cardTypes.filter((t) => this.peekCard(t)) : [],
      choseType: this.choseType,
      card: this.currentCard ? { type: this.currentCard.type, content: this.currentCard.content } : null,
      submission: this.submission,
      resolution: this.resolution,
      status: this.statusText(),
    };
  }

  isFinished(): boolean {
    return this.finished;
  }

  getFinalResult(): RoomResultSummary {
    const totalAnswers = this.doneCount + this.passCount + this.rejectedCount;
    const coupleScorePct = totalAnswers > 0 ? Math.round((this.doneCount / totalAnswers) * 100) : 0;
    const [p1, p2] = this.host.players;
    const skipped = this.passCount + this.rejectedCount;
    const summaryLabel = `${this.doneCount} carte${this.doneCount > 1 ? "s" : ""} relevée${this.doneCount > 1 ? "s" : ""}, ${skipped} passée${skipped > 1 ? "s" : ""} ou refusée${skipped > 1 ? "s" : ""}`;
    return {
      coupleScorePct,
      player1Score: p1?.score ?? 0,
      player2Score: p2?.score ?? 0,
      matchingAnswers: this.doneCount,
      differentAnswers: skipped,
      totalAnswers,
      bestStreak: this.bestStreak,
      summaryLabel,
      verdict: verdictFor(coupleScorePct, totalAnswers),
      rounds: [...this.recap],
    };
  }

  // ---- interne ----

  private needsText(): boolean {
    return !!this.currentCard && WRITTEN_TYPES.has(this.currentCard.type);
  }

  private drawCard(requested: string): ActionResult {
    let type = this.cardTypes.includes(requested) && this.peekCard(requested) ? requested : null;
    // tolérance : type inconnu ou épuisé -> on pioche dans ce qui reste
    if (!type) type = this.cardTypes.find((t) => this.peekCard(t)) ?? null;
    if (!type) return { ok: false, error: "NO_MORE_CARDS" };
    this.currentCard = this.pickCard(type);
    this.choseType = type;
    this.phase = "CARD";
    return { ok: true };
  }

  private resolve(result: TurnResult, turnPlayerId: string) {
    this.resolution = { result, byPlayerId: turnPlayerId };
    if (result === "DONE") {
      this.doneCount += 1;
      this.currentStreak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.currentStreak);
      if (this.host.scoringEnabled) this.host.addScore(turnPlayerId, POINTS_PER_DONE);
    } else {
      if (result === "PASS") this.passCount += 1;
      else this.rejectedCount += 1;
      this.currentStreak = 0;
    }
    this.recap.push({
      round: this.round,
      prompt: this.currentCard?.content ?? "",
      type: this.currentCard?.type,
      byPlayerId: turnPlayerId,
      result,
      text: this.submission?.text ?? null,
    });
    this.phase = "RESOLVED";
  }

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
    const judge = this.host.players.find((p) => p.id !== turn?.id);
    if (this.phase === "CHOOSE") return `C'est à ${turn?.displayName ?? "…"} de choisir (${this.round}/${this.host.totalRounds})`;
    if (this.phase === "CARD") return `${turn?.displayName ?? "…"} relève la carte`;
    if (this.phase === "JUDGE") return `${judge?.displayName ?? "…"} doit valider`;
    if (this.resolution?.result === "DONE") return "✅ Validé ! Prêt pour le tour suivant";
    if (this.resolution?.result === "REJECTED") return "❌ Pas validé. Prêt pour le tour suivant";
    return "⏭️ Passé. Prêt pour le tour suivant";
  }
}
