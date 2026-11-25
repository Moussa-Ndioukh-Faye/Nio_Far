import { describe, expect, it } from "vitest";
import { deckOf, makeEngine } from "./helpers";

function finish(e: ReturnType<typeof makeEngine>) {
  while (e.getStatus() === "PLAYING") {
    e.act("A", "answer", { value: "A" });
    e.act("B", "answer", { value: "A" });
    e.next("A");
  }
}

describe("GameEngine", () => {
  it("seul un état READY permet de démarrer", () => {
    const e = makeEngine({ start: false });
    expect(e.start().error).toBe("NOT_READY");
    e.setPlayerReady("A", true);
    e.setPlayerReady("B", true);
    expect(e.start().ok).toBe(true);
  });

  it("n'expose jamais les socketId", () => {
    const e = makeEngine({});
    for (const p of e.getPublicState().meta.players) expect(p).not.toHaveProperty("socketId");
  });

  it("revanche : il faut les deux votes, puis scores remis à zéro et nouveau paquet", () => {
    const e = makeEngine({ totalRounds: 2 });
    expect(e.voteRematch("A").error).toBe("NOT_FINISHED");
    finish(e);
    expect(e.getPlayers().every((p) => p.score > 0)).toBe(true);
    expect(e.voteRematch("A")).toEqual({ ok: true, ready: false });
    expect(e.getPublicState().meta.rematchVotes).toEqual(["A"]);
    expect(e.voteRematch("B")).toEqual({ ok: true, ready: true });
    expect(e.restart(deckOf(4)).ok).toBe(true);
    const meta = e.getPublicState().meta;
    expect(meta.status).toBe("PLAYING");
    expect(meta.gamesPlayed).toBe(2);
    expect(meta.rematchVotes).toEqual([]);
    expect(e.getPlayers().every((p) => p.score === 0)).toBe(true);
  });

  it("garde les 100 derniers messages du chat", () => {
    const e = makeEngine({});
    for (let i = 0; i < 120; i++) e.addChat({ id: `m${i}`, playerId: "A", text: `msg ${i}`, createdAt: i });
    const chat = e.getChat();
    expect(chat).toHaveLength(100);
    expect(chat[0].id).toBe("m20");
  });
});
