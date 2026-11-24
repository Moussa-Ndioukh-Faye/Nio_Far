import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deckOf, makeEngine } from "./helpers";
import { StandardReveal, StandardView, FinishedView } from "../types";

const view = (e: ReturnType<typeof makeEngine>) => e.getPublicState().view as StandardView;

describe("StandardRules — réponses simultanées", () => {
  it("révèle seulement quand les deux ont répondu, sans dévoiler la réponse avant", () => {
    const e = makeEngine({});
    expect(e.act("A", "answer", { value: "A" }).ok).toBe(true);
    const v = view(e);
    expect(v.phase).toBe("QUESTION");
    expect(v.answeredPlayerIds).toEqual(["A"]);
    expect(v.reveal).toBeNull();
    e.act("B", "answer", { value: "A" });
    expect(view(e).phase).toBe("REVEAL");
    expect(view(e).reveal?.isMatch).toBe(true);
  });

  it("donne 10 points à chacun en cas d'accord et compte la meilleure série", () => {
    const e = makeEngine({ totalRounds: 3 });
    for (const [a, b] of [["A", "A"], ["B", "B"], ["A", "C"]]) {
      e.act("A", "answer", { value: a });
      e.act("B", "answer", { value: b });
      e.next("A");
    }
    expect(e.getStatus()).toBe("FINISHED");
    const res = (e.getPublicState().view as FinishedView).result;
    expect(res.matchingAnswers).toBe(2);
    expect(res.differentAnswers).toBe(1);
    expect(res.bestStreak).toBe(2);
    expect(res.coupleScorePct).toBe(67);
    expect(res.player1Score).toBe(20);
    expect(res.rounds).toHaveLength(3);
    expect(res.verdict).toBeTruthy();
  });

  it("refuse une option inexistante et une double réponse", () => {
    const e = makeEngine({});
    expect(e.act("A", "answer", { value: "Z" }).error).toBe("INVALID_OPTION");
    e.act("A", "answer", { value: "A" });
    expect(e.act("A", "answer", { value: "B" }).error).toBe("ALREADY_ANSWERED");
  });

  it("« Qui de nous deux ? » : MOI chez l'un = MON PARTENAIRE chez l'autre -> accord", () => {
    const e = makeEngine({ deck: deckOf(5, { options: ["MOI", "MON PARTENAIRE"] }) });
    e.act("A", "answer", { value: "MON PARTENAIRE" }); // Moussa désigne Awa
    e.act("B", "answer", { value: "MOI" }); //            Awa se désigne
    const r = view(e).reveal as StandardReveal;
    expect(r.isMatch).toBe(true);
    expect(r.display).toEqual({ A: "Awa", B: "Awa" });
  });

  it("« Qui de nous deux ? » : MOI des deux côtés -> désaccord", () => {
    const e = makeEngine({ deck: deckOf(5, { options: ["MOI", "MON PARTENAIRE"] }) });
    e.act("A", "answer", { value: "MOI" });
    e.act("B", "answer", { value: "MOI" });
    expect(view(e).reveal?.isMatch).toBe(false);
  });

  it("ne propose pas plus de manches que de cartes", () => {
    const e = makeEngine({ deck: deckOf(3), totalRounds: 20 });
    expect(e.getPublicState().meta.totalRounds).toBe(3);
  });
});

describe("StandardRules — chrono", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("expose une échéance et révèle tout seul à la fin du chrono", () => {
    const e = makeEngine({ timerSeconds: 10 });
    const onUpdate = vi.fn();
    e.setUpdateListener(onUpdate);
    const v = view(e);
    expect(v.deadline).toBe(Date.now() + 10_000);

    e.act("A", "answer", { value: "A" });
    vi.advanceTimersByTime(10_100);

    const r = view(e).reveal as StandardReveal;
    expect(view(e).phase).toBe("REVEAL");
    expect(r.timedOut).toEqual(["B"]);
    expect(r.isMatch).toBe(false);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("refuse une réponse arrivée trop tard", () => {
    const e = makeEngine({ timerSeconds: 5 });
    vi.setSystemTime(Date.now() + 6_000); // l'horloge avance sans déclencher le timer
    expect(e.act("A", "answer", { value: "A" }).error).toBe("TOO_LATE");
  });

  it("bonus de rapidité au plus vif quand les réponses concordent", () => {
    const e = makeEngine({ timerSeconds: 15, speedBonus: true });
    vi.advanceTimersByTime(1_000);
    e.act("B", "answer", { value: "A" });
    vi.advanceTimersByTime(2_000);
    e.act("A", "answer", { value: "A" });
    const r = view(e).reveal as StandardReveal;
    expect(r.fastestPlayerId).toBe("B");
    expect(r.scoreDelta).toEqual({ A: 10, B: 15 });
  });

  it("relance le chrono à la question suivante et l'arrête en fin de partie", () => {
    const e = makeEngine({ timerSeconds: 5, totalRounds: 2 });
    vi.advanceTimersByTime(5_100);
    expect(view(e).phase).toBe("REVEAL");
    e.next("A");
    expect(view(e).deadline).toBe(Date.now() + 5_000);
    vi.advanceTimersByTime(5_100);
    e.next("B");
    expect(e.getStatus()).toBe("FINISHED");
    expect(vi.getTimerCount()).toBe(0);
  });
});
