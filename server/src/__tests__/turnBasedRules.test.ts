import { describe, expect, it } from "vitest";
import { deckOf, makeEngine } from "./helpers";
import { FinishedView, TurnBasedView } from "../types";

const view = (e: ReturnType<typeof makeEngine>) => e.getPublicState().view as TurnBasedView;

function truthOrDare(totalRounds = 4) {
  const deck = [...deckOf(6, { type: "TRUTH", options: [] }), ...deckOf(6, { type: "DARE", options: [] }).map((c) => ({ ...c, id: `d${c.id}` }))];
  return makeEngine({ family: "TURN_BASED", cardTypes: ["TRUTH", "DARE"], deck, totalRounds, gameType: "TRUTH_OR_DARE" });
}

describe("TurnBasedRules — validation par le partenaire", () => {
  it("vérité écrite -> le partenaire valide -> points au joueur du tour", () => {
    const e = truthOrDare();
    expect(view(e).turnPlayerId).toBe("A");
    expect(view(e).judgePlayerId).toBe("B");
    expect(e.act("B", "choose", { type: "TRUTH" }).error).toBe("NOT_YOUR_TURN");
    expect(e.act("A", "choose", { type: "TRUTH" }).ok).toBe(true);
    expect(view(e).phase).toBe("CARD");
    expect(e.act("A", "submit", { text: "  " }).error).toBe("TEXT_REQUIRED");
    expect(e.act("A", "submit", { text: "Ma vraie réponse" }).ok).toBe(true);
    expect(view(e).phase).toBe("JUDGE");
    expect(view(e).submission?.text).toBe("Ma vraie réponse");
    expect(e.act("A", "judge", { result: "DONE" }).error).toBe("CANNOT_JUDGE_YOURSELF");
    expect(e.act("B", "judge", { result: "DONE" }).ok).toBe(true);
    expect(view(e).resolution).toEqual({ result: "DONE", byPlayerId: "A" });
    expect(e.getPlayers().find((p) => p.id === "A")?.score).toBe(5);
  });

  it("action sans texte, refusée par le partenaire -> pas de points", () => {
    const e = truthOrDare();
    e.act("A", "choose", { type: "DARE" });
    expect(e.act("A", "submit", {}).ok).toBe(true);
    e.act("B", "judge", { result: "REJECTED" });
    expect(view(e).resolution?.result).toBe("REJECTED");
    expect(e.getPlayers().find((p) => p.id === "A")?.score).toBe(0);
  });

  it("passer, alterner les tours, finir avec un récap", () => {
    const e = truthOrDare(2);
    e.act("A", "choose", { type: "TRUTH" });
    e.act("A", "pass");
    e.next("B");
    expect(view(e).turnPlayerId).toBe("B");
    e.act("B", "choose", { type: "DARE" });
    e.act("B", "submit", {});
    e.act("A", "judge", { result: "DONE" });
    e.next("A");
    expect(e.getStatus()).toBe("FINISHED");
    const res = (e.getPublicState().view as FinishedView).result;
    expect(res.rounds.map((r) => r.result)).toEqual(["PASS", "DONE"]);
    expect(res.matchingAnswers).toBe(1);
    expect(res.player2Score).toBe(5);
  });

  it("un seul type de carte : la carte est piochée directement", () => {
    const e = makeEngine({ family: "TURN_BASED", cardTypes: ["QUESTION"], deck: deckOf(5, { options: [] }), gameType: "COUPLE_QUESTIONS" });
    expect(view(e).phase).toBe("CARD");
    expect(view(e).card?.content).toBe("Question 0");
  });

  it("s'arrête proprement quand le paquet est vide", () => {
    const e = makeEngine({ family: "TURN_BASED", cardTypes: ["DARE"], deck: deckOf(2, { type: "DARE", options: [] }), totalRounds: 10 });
    expect(e.getPublicState().meta.totalRounds).toBe(2);
    for (const p of ["A", "B"]) {
      e.act(p, "pass");
      e.next(p);
    }
    expect(e.getStatus()).toBe("FINISHED");
  });

  it("compat : l'ancien « resolve DONE » passe par la validation du partenaire", () => {
    const e = truthOrDare();
    e.act("A", "choose", { type: "DARE" });
    e.act("A", "resolve", { result: "DONE" });
    expect(view(e).phase).toBe("JUDGE");
  });
});
