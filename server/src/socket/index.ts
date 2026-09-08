import { Server, Socket } from "socket.io";
import { nanoid } from "nanoid/non-secure";
import { roomManager } from "../game-engine/RoomManager";
import { getCatalogEntry } from "../game-engine/catalog";
import { loadDeckForGame, prisma } from "../services/contentService";
import { upsertPlayerConnection, markPlayerDisconnected } from "../services/persistence";
import { logger } from "../utils/logger";
import { isSocketRateLimited, clearSocketRateLimit } from "../middleware/rateLimit";
import { createRoomSchema, joinRoomSchema, chatMessageSchema, reconnectSchema, gameActSchema, gameNextSchema } from "../middleware/validation";

// playerId <-> socket.id mapping pour retrouver un joueur lors d'une reconnexion
const playerSocketIndex: Map<string, string> = new Map(); // playerId -> current socketId
const socketPlayerIndex: Map<string, { playerId: string; roomId: string }> = new Map(); // socketId -> playerId/roomId

export function registerSocketHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    logger.info("Nouvelle connexion socket", { id: socket.id });

    // ---- room:create ----
    socket.on("room:create", async (payload, ack) => {
      if (guard(socket, ack)) return;
      const parsed = createRoomSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: "INVALID_PAYLOAD" });

      const game = getCatalogEntry(parsed.data.gameType);
      const totalRounds = game.roundsByDifficulty[parsed.data.difficulty];
      const cardTypes = game.cardType === "MIXED" ? game.options.length : 1;
      const deckCount = game.family === "TURN_BASED" ? totalRounds * cardTypes : totalRounds;

      const deck = await loadDeckForGame({
        gameType: parsed.data.gameType,
        difficulty: parsed.data.difficulty,
        count: deckCount,
      });
      if (deck.length < 1) return ack?.({ ok: false, error: "NO_CONTENT" });

      const playerId = nanoid();
      const engine = roomManager.createRoom({
        gameType: parsed.data.gameType,
        difficulty: parsed.data.difficulty,
        hostId: playerId,
        deck,
      });

      const add = engine.addPlayer({ id: playerId, displayName: parsed.data.displayName, socketId: socket.id });
      if (!add.ok) return ack?.({ ok: false, error: add.reason });
      registerPlayerSocket(playerId, socket.id, engine.getRoomId());

      // Persistance (au minimum la création, pour audit / reprise / historique)
      await prisma.gameSession
        .create({
          data: {
            id: engine.getRoomId(),
            code: engine.getCode(),
            gameType: engine.getGameType(),
            category: engine.getMetaData().category,
            difficulty: engine.getMetaData().difficulty,
            scoringEnabled: engine.getMetaData().scoringEnabled,
            totalRounds: engine.getMetaData().totalRounds,
            status: "WAITING",
            hostPlayerId: playerId,
            questionOrder: deck.map((c) => c.id),
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 6),
          },
        })
        .catch((e: unknown) => logger.warn("Persist gameSession failed", e));

      await upsertPlayerConnection({
        playerId,
        sessionId: engine.getRoomId(),
        socketId: socket.id,
        displayName: parsed.data.displayName,
        deviceId: parsed.data.deviceId,
      });

      socket.join(engine.getRoomId());
      ack?.({
        ok: true,
        roomId: engine.getRoomId(),
        code: engine.getCode(),
        playerId,
        gameName: game.name,
        state: engine.getPublicState(),
      });
    });

    // ---- room:join ----
    socket.on("room:join", async (payload, ack) => {
      if (guard(socket, ack)) return;
      const parsed = joinRoomSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: "INVALID_PAYLOAD" });

      const engine = roomManager.getByCode(parsed.data.code);
      if (!engine) return ack?.({ ok: false, error: "ROOM_NOT_FOUND" });

      const playerId = parsed.data.playerId ?? nanoid();
      const result = engine.addPlayer({
        id: playerId,
        displayName: parsed.data.displayName,
        socketId: socket.id,
      });

      if (!result.ok) {
        if (result.reason === "ROOM_FULL") return ack?.({ ok: false, error: "ROOM_FULL" });
        if (result.reason === "PLAYER_ALREADY_IN_ROOM") {
          // Refresh de page — traiter comme une reconnexion.
          engine.reconnectPlayer(playerId, socket.id);
        } else {
          return ack?.({ ok: false, error: result.reason });
        }
      }

      registerPlayerSocket(playerId, socket.id, engine.getRoomId());
      socket.join(engine.getRoomId());

      await upsertPlayerConnection({
        playerId,
        sessionId: engine.getRoomId(),
        socketId: socket.id,
        displayName: parsed.data.displayName,
        deviceId: parsed.data.deviceId,
      });

      io.to(engine.getRoomId()).emit("room:player_joined", { state: engine.getPublicState() });
      ack?.({ ok: true, roomId: engine.getRoomId(), playerId, state: engine.getPublicState() });
    });

    // ---- player:ready ----
    socket.on("player:ready", (payload: { roomId: string; ready: boolean }, ack) => {
      if (guard(socket, ack)) return;
      const engine = roomManager.getById(payload.roomId);
      if (!engine) return ack?.({ ok: false, error: "ROOM_NOT_FOUND" });
      const ctx = socketPlayerIndex.get(socket.id);
      if (!ctx) return ack?.({ ok: false, error: "NOT_IN_ROOM" });

      engine.setPlayerReady(ctx.playerId, payload.ready);
      broadcastState(io, engine);
      ack?.({ ok: true });
    });

    // ---- game:start ----
    socket.on("game:start", async (payload: { roomId: string }, ack) => {
      if (guard(socket, ack)) return;
      const engine = roomManager.getById(payload.roomId);
      if (!engine) return ack?.({ ok: false, error: "ROOM_NOT_FOUND" });

      const res = engine.start();
      if (!res.ok) return ack?.({ ok: false, error: res.error ?? "CANNOT_START" });

      await prisma.gameSession.update({ where: { id: engine.getRoomId() }, data: { status: "PLAYING" } }).catch(() => {});
      broadcastState(io, engine);
      ack?.({ ok: true });
    });

    // ---- game:act (action générique du ruleset : answer, choose, resolve…) ----
    socket.on("game:act", async (payload, ack) => {
      if (guard(socket, ack)) return;
      const parsed = gameActSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: "INVALID_PAYLOAD" });

      const engine = roomManager.getById(parsed.data.roomId);
      if (!engine) return ack?.({ ok: false, error: "ROOM_NOT_FOUND" });
      const ctx = socketPlayerIndex.get(socket.id);
      if (!ctx || ctx.roomId !== parsed.data.roomId) return ack?.({ ok: false, error: "NOT_IN_ROOM" });

      const res = engine.act(ctx.playerId, parsed.data.action, parsed.data.payload);
      if (!res.ok) return ack?.({ ok: false, error: res.error });

      broadcastState(io, engine);
      ack?.({ ok: true });
    });

    // ---- game:next (question suivante / tour suivant) ----
    socket.on("game:next", async (payload, ack) => {
      if (guard(socket, ack)) return;
      const parsed = gameNextSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: "INVALID_PAYLOAD" });

      const engine = roomManager.getById(parsed.data.roomId);
      if (!engine) return ack?.({ ok: false, error: "ROOM_NOT_FOUND" });
      const ctx = socketPlayerIndex.get(socket.id);
      if (!ctx || ctx.roomId !== parsed.data.roomId) return ack?.({ ok: false, error: "NOT_IN_ROOM" });

      const res = engine.next(ctx.playerId);
      if (!res.ok) return ack?.({ ok: false, error: res.error });

      if (engine.getStatus() === "FINISHED") {
        const result = engine.getFinalResult();
        await prisma.gameSession.update({ where: { id: engine.getRoomId() }, data: { status: "FINISHED" } }).catch(() => {});
        await prisma.gameResult
          .create({
            data: {
              sessionId: engine.getRoomId(),
              coupleScorePct: result.coupleScorePct,
              player1Score: result.player1Score,
              player2Score: result.player2Score,
              matchingAnswers: result.matchingAnswers,
              differentAnswers: result.differentAnswers,
              bestStreak: result.bestStreak,
            },
          })
          .catch(() => {});
        for (const p of engine.getPlayers()) {
          await prisma.player.update({ where: { id: p.id }, data: { score: p.score } }).catch(() => {});
        }
      }

      broadcastState(io, engine);
      ack?.({ ok: true, result: engine.getStatus() === "FINISHED" ? engine.getFinalResult() : undefined });
    });

    // ---- chat:message ----
    socket.on("chat:message", async (payload, ack) => {
      if (guard(socket, ack)) return;
      const parsed = chatMessageSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: "INVALID_PAYLOAD" });
      const ctx = socketPlayerIndex.get(socket.id);
      if (!ctx) return ack?.({ ok: false, error: "NOT_IN_ROOM" });

      const message = {
        playerId: ctx.playerId,
        text: parsed.data.text,
        createdAt: Date.now(),
      };
      io.to(parsed.data.roomId).emit("chat:message", message);
      await prisma.chatMessage
        .create({ data: { sessionId: parsed.data.roomId, playerId: ctx.playerId, text: parsed.data.text } })
        .catch(() => {});
      ack?.({ ok: true });
    });

    // ---- player:reconnect (reconnexion explicite avec playerId connu, ex: après refresh) ----
    socket.on("player:reconnect", async (payload, ack) => {
      const parsed = reconnectSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: "INVALID_PAYLOAD" });

      const engine = roomManager.getById(parsed.data.roomId);
      if (!engine) return ack?.({ ok: false, error: "ROOM_NOT_FOUND" });

      const reconnected = engine.reconnectPlayer(parsed.data.playerId, socket.id);
      if (!reconnected) return ack?.({ ok: false, error: "PLAYER_NOT_FOUND" });

      registerPlayerSocket(parsed.data.playerId, socket.id, engine.getRoomId());
      socket.join(engine.getRoomId());

      const p = engine.getPlayers().find((pl) => pl.id === parsed.data.playerId);
      await upsertPlayerConnection({
        playerId: parsed.data.playerId,
        sessionId: engine.getRoomId(),
        socketId: socket.id,
        displayName: p?.displayName ?? "Joueur",
      });

      io.to(engine.getRoomId()).emit("player:reconnect", { playerId: parsed.data.playerId });
      // Resynchronisation complète pour le joueur revenu.
      socket.emit("state:update", engine.getPublicState());
      ack?.({ ok: true, state: engine.getPublicState() });
    });

    // ---- déconnexion (coupure réseau, fermeture d'onglet) ----
    socket.on("disconnect", () => {
      const ctx = socketPlayerIndex.get(socket.id);
      clearSocketRateLimit(socket.id);
      if (!ctx) return;

      const engine = roomManager.getById(ctx.roomId);
      if (!engine) return;

      io.to(ctx.roomId).emit("player:disconnect", { playerId: ctx.playerId });
      engine.markDisconnected(ctx.playerId, () => {
        // Grace period expirée -> partie abandonnée (règle #5)
        prisma.gameSession
          .update({ where: { id: ctx.roomId }, data: { status: "ABANDONED" } })
          .catch(() => {});
        broadcastState(io, engine);
        roomManager.destroyRoom(ctx.roomId);
      });

      socketPlayerIndex.delete(socket.id);
      markPlayerDisconnected(ctx.playerId);
      // NB: on garde playerSocketIndex pour permettre reconnectPlayer() de le retrouver si besoin.
    });

    socket.on("room:leave", (payload: { roomId: string }) => {
      const engine = roomManager.getById(payload.roomId);
      const ctx = socketPlayerIndex.get(socket.id);
      if (engine && ctx) {
        engine.removePlayer(ctx.playerId);
        io.to(payload.roomId).emit("room:player_left", { playerId: ctx.playerId });
        socket.leave(payload.roomId);
        if (engine.getPlayers().length === 0) roomManager.destroyRoom(payload.roomId);
      }
    });
  });

  // Nettoyage périodique des rooms inactives (règle #24.10 / #23 expiration)
  setInterval(() => roomManager.cleanupExpired(), 1000 * 60 * 10);
}

function broadcastState(io: Server, engine: ReturnType<typeof roomManager.getById>) {
  if (!engine) return;
  io.to(engine.getRoomId()).emit("state:update", engine.getPublicState());
}

function registerPlayerSocket(playerId: string, socketId: string, roomId: string) {
  playerSocketIndex.set(playerId, socketId);
  socketPlayerIndex.set(socketId, { playerId, roomId });
}

/** Garde anti-abus simple sur les événements les plus sensibles. */
function guard(socket: Socket, ack?: (res: unknown) => void): boolean {
  if (isSocketRateLimited(socket.id)) {
    ack?.({ ok: false, error: "RATE_LIMITED" });
    return true;
  }
  return false;
}