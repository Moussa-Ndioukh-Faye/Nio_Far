import http from "http";
import { AddressInfo } from "net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Server } from "socket.io";
import { io as ioc, Socket } from "socket.io-client";
import { deckOf } from "./helpers";

// Pas de base de données en test : contenu et persistance simulés.
vi.mock("../services/contentService", () => {
  const noop = async () => ({});
  const model = new Proxy({}, { get: () => noop });
  return {
    prisma: new Proxy({}, { get: () => model }),
    loadDeckForGame: async () => deckOf(10, { options: ["A", "B"] }),
    loadDeck: async () => deckOf(10, { options: ["A", "B"] }),
  };
});
vi.mock("../services/persistence", () => ({
  upsertPlayerConnection: async () => {},
  markPlayerDisconnected: async () => {},
}));

const { registerSocketHandlers } = await import("../socket");

let httpServer: http.Server;
let io: Server;
let url = "";
const sockets: Socket[] = [];

function client() {
  const s = ioc(url, { transports: ["websocket"], reconnection: false, forceNew: true });
  sockets.push(s);
  return s;
}
const ack = <T = any>(s: Socket, ev: string, payload: unknown) => new Promise<T>((r) => s.emit(ev, payload, (res: T) => { if (process.env.DBG) console.error("ACK", ev, JSON.stringify(res).slice(0, 120)); r(res); }));
const nextEvent = <T = any>(s: Socket, ev: string) => new Promise<T>((r) => s.once(ev, r));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  httpServer = http.createServer();
  io = new Server(httpServer);
  registerSocketHandlers(io);
  await new Promise<void>((r) => httpServer.listen(0, r));
  url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
});

afterAll(async () => {
  sockets.forEach((s) => s.disconnect());
  io.close();
  await new Promise((r) => httpServer.close(r));
});

async function setupRoom(gameType = "GUESS_ME") {
  const a = client();
  const b = client();
  const created = await ack(a, "room:create", { displayName: "Moussa", gameType, difficulty: "SOFT" });
  const joined = await ack(b, "room:join", { displayName: "Awa", code: created.code });
  return { a, b, created, joined, roomId: created.roomId as string };
}

describe("Socket.IO — partie complète à deux appareils", () => {
  it("crée, rejoint, joue, discute et fait une revanche", async () => {
    const { a, b, created, joined, roomId } = await setupRoom();
    expect(created.ok && joined.ok).toBe(true);

    await ack(a, "player:ready", { roomId, ready: true });
    await ack(b, "player:ready", { roomId, ready: true });
    expect((await ack(b, "game:start", { roomId })).error).toBe("NOT_HOST");
    expect((await ack(a, "game:start", { roomId })).ok).toBe(true);

    // chat + historique + indicateur de saisie
    const typing = nextEvent(b, "chat:typing");
    a.emit("chat:typing", { roomId, typing: true });
    expect(await typing).toEqual({ playerId: created.playerId, typing: true });
    await ack(a, "chat:message", { roomId, text: "Coucou 💞" });

    // reconnexion de B sur un nouveau socket : il récupère l'état et le chat
    const b2 = client();
    const rec = await ack(b2, "player:reconnect", { roomId, playerId: joined.playerId });
    expect(rec.ok).toBe(true);
    expect(rec.messages.map((m: any) => m.text)).toEqual(["Coucou 💞"]);
    b.disconnect();
    await sleep(100);

    // jouer toute la partie
    let state = rec.state;
    while (state.meta.status === "PLAYING") {
      await sleep(600); // rythme humain : la limite anti-spam est de 20 actions / 5 s (2 actions par manche)
      await ack(a, "game:act", { roomId, action: "answer", payload: { value: "A" } });
      await ack(b2, "game:act", { roomId, action: "answer", payload: { value: "A" } });
      const upd = nextEvent(a, "state:update");
      await ack(a, "game:next", { roomId });
      state = await upd;
    }
    expect(state.meta.status).toBe("FINISHED");
    expect(state.view.result.coupleScorePct).toBe(100);
    expect(state.meta.players.every((p: any) => p.isConnected)).toBe(true);

    // revanche
    expect((await ack(a, "game:rematch", { roomId })).started).toBe(false);
    const restarted = nextEvent(a, "state:update");
    expect((await ack(b2, "game:rematch", { roomId })).started).toBe(true);
    const s2 = await restarted;
    expect(s2.meta.status).toBe("PLAYING");
    expect(s2.meta.gamesPlayed).toBe(2);
  }, 20_000);

  it("isole les rooms : pas de chat ni d'action dans une autre partie", async () => {
    const { a, roomId } = await setupRoom();
    const { a: intruder } = await setupRoom();
    let leaked = false;
    a.on("chat:message", (m) => m.text === "spam" && (leaked = true));
    expect((await ack(intruder, "chat:message", { roomId, text: "spam" })).error).toBe("NOT_IN_ROOM");
    expect((await ack(intruder, "game:act", { roomId, action: "answer", payload: { value: "A" } })).error).toBe("NOT_IN_ROOM");
    expect((await ack(intruder, "game:rematch", { roomId })).error).toBe("NOT_IN_ROOM");
    await sleep(50);
    expect(leaked).toBe(false);
  });

  it("expose le chrono serveur aux clients (Quiz chronométré)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const { a, b, roomId } = await setupRoom("TIMED_QUIZ");
      await ack(a, "player:ready", { roomId, ready: true });
      await ack(b, "player:ready", { roomId, ready: true });
      const started = nextEvent(a, "state:update");
      await ack(a, "game:start", { roomId });
      const s = await started;
      expect(s.meta.timerSeconds).toBe(15);
      expect(s.view.deadline).toBe(s.serverNow + 15_000);
    } finally {
      vi.useRealTimers();
    }
  });
});
